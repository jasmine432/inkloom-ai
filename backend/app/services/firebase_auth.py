import logging
import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
import firebase_admin
from firebase_admin import auth, credentials

from backend.app.config import settings

logger = logging.getLogger("inkloom_auth")


class AuthenticatedUser(BaseModel):
    """
    Verified user identity returned from server-side Firebase ID token validation.
    Never trusts client-supplied flags; all claims originate from verified Firebase signatures.
    """
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    email_verified: bool = False
    auth_time: Optional[int] = None
    issuer: Optional[str] = None
    audience: Optional[str] = None


class InMemoryRateLimiter:
    """
    In-memory sliding-window rate limiter for sensitive endpoints.
    Protects auth endpoints against automated brute-force attacks and abuse.
    """
    def __init__(self, limit: int = 60, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        # Clean older requests outside the active sliding window
        self.requests[client_key] = [
            ts for ts in self.requests[client_key] if ts > window_start
        ]
        if len(self.requests[client_key]) >= self.limit:
            return False
        self.requests[client_key].append(now)
        return True


rate_limiter = InMemoryRateLimiter(limit=settings.AUTH_RATE_LIMIT_PER_MINUTE)


class FirebaseAuthService:
    """
    Server-side Firebase Admin Authentication Service.
    Verifies ID tokens, checks revocation, audience, signature, and expiry.
    """
    def __init__(self):
        self._app: Optional[firebase_admin.App] = None
        self._mock_verifier = None
        self.initialize()

    def initialize(self):
        if self._app is not None or firebase_admin._apps:
            self._app = firebase_admin.get_app()
            return

        try:
            # 1. Check if a local service-account JSON path is provided and exists
            if settings.FIREBASE_CREDENTIALS_PATH:
                cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    self._app = firebase_admin.initialize_app(cred)
                    logger.info("Firebase Admin initialized using credentials file.")
                    return
                else:
                    logger.warning("FIREBASE_CREDENTIALS_PATH specified but file does not exist: %s", cred_path)

            # 2. Check if inline service-account credentials exist in environment
            if (
                settings.FIREBASE_PROJECT_ID
                and settings.FIREBASE_CLIENT_EMAIL
                and settings.FIREBASE_PRIVATE_KEY
            ):
                private_key = settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")
                cred_dict = {
                    "type": "service_account",
                    "project_id": settings.FIREBASE_PROJECT_ID,
                    "client_email": settings.FIREBASE_CLIENT_EMAIL,
                    "private_key": private_key,
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
                cred = credentials.Certificate(cred_dict)
                self._app = firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin initialized using environment service-account.")
                return

            # 3. Check if only Project ID is provided (e.g. for default credentials / public keys)
            if settings.FIREBASE_PROJECT_ID:
                self._app = firebase_admin.initialize_app(
                    options={"projectId": settings.FIREBASE_PROJECT_ID}
                )
                logger.info("Firebase Admin initialized with projectId: %s", settings.FIREBASE_PROJECT_ID)
                return

            logger.info("Firebase Admin not configured with credentials. Running in unconfigured/mock-ready mode.")
        except Exception as e:
            logger.warning("Could not initialize Firebase Admin SDK: %s", str(e))
            self._app = None

    @property
    def is_configured(self) -> bool:
        return self._app is not None or self._mock_verifier is not None

    def set_mock_verifier(self, verifier_fn):
        """Allows test suites to mock verification safely without live Firebase network calls."""
        self._mock_verifier = verifier_fn

    def verify_token(self, token: str, check_revoked: bool = True) -> AuthenticatedUser:
        """
        Independently verifies a Firebase ID token.
        Never logs or exposes the token value.
        """
        if not token or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty or missing bearer authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Allow automated unit tests to verify tokens using registered mock verifier
        if self._mock_verifier is not None:
            return self._mock_verifier(token)

        # Allow simulation tokens strictly in development mode when enabled
        if token.startswith("sim_token_"):
            if (
                settings.ENVIRONMENT.lower() != "development"
                or not settings.ALLOW_DEV_SIMULATION_TOKENS
            ):
                logger.warning("Rejected development simulation token in production/non-dev mode.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Development simulation tokens are rejected in production mode.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            if token.startswith("sim_token_unverified_"):
                sim_uid = token[len("sim_token_unverified_"):].strip()
                email_verified = False
            else:
                sim_uid = token[len("sim_token_"):].strip()
                email_verified = True

            if sim_uid:
                clean_email = f"{sim_uid}@inkloom.local" if "@" not in sim_uid else sim_uid
                clean_name = sim_uid.replace("sim_usr_", "User ").replace("-", " ").title()
                return AuthenticatedUser(
                    uid=sim_uid,
                    email=clean_email,
                    name=clean_name,
                    email_verified=email_verified,
                )

        if not self._app and not firebase_admin._apps:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Firebase Authentication is not configured on the server. Please check FIREBASE_PROJECT_ID.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            # Verify signature, expiry, audience, and revocation status
            decoded_token = auth.verify_id_token(
                token,
                check_revoked=check_revoked,
                app=self._app,
            )

            uid = decoded_token.get("uid") or decoded_token.get("sub")
            if not uid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed token: missing subject/uid.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return AuthenticatedUser(
                uid=uid,
                email=decoded_token.get("email"),
                name=decoded_token.get("name") or decoded_token.get("display_name"),
                email_verified=bool(decoded_token.get("email_verified", False)),
                auth_time=decoded_token.get("auth_time"),
                issuer=decoded_token.get("iss"),
                audience=decoded_token.get("aud"),
            )
        except auth.ExpiredIdTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Token expired\""},
            )
        except auth.RevokedIdTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has been revoked. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Token revoked\""},
            )
        except auth.InvalidIdTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token signature or claims.",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            )
        except auth.CertificateFetchError:
            logger.error("Failed to fetch public certificates for Firebase ID token verification.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to fetch authentication verification certificates at this time.",
            )
        except HTTPException:
            raise
        except Exception as e:
            # Log general exception without logging token or sensitive payload
            logger.warning("Token verification failed: %s", type(e).__name__)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token verification failed.",
                headers={"WWW-Authenticate": "Bearer"},
            )


firebase_auth_service = FirebaseAuthService()


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------

def extract_bearer_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """
    Extracts Bearer token from the standard Authorization header.
    Returns None if header is absent; raises HTTP 401 if malformed.
    """
    if not authorization:
        return None

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1]


def get_current_user(token: Optional[str] = Header(None, alias="Authorization")) -> AuthenticatedUser:
    """
    Enforces authentication on the server.
    Extracts and verifies the Firebase ID token, returning verified AuthenticatedUser.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = token.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return firebase_auth_service.verify_token(parts[1])


def get_optional_user(token: Optional[str] = Header(None, alias="Authorization")) -> Optional[AuthenticatedUser]:
    """
    Optional authentication dependency.
    If valid Authorization header is provided, returns verified AuthenticatedUser.
    If header is omitted, malformed, or cannot be verified, logs warning and returns None
    so review analysis can still proceed smoothly without disruption.
    """
    if not token:
        return None

    parts = token.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    try:
        return firebase_auth_service.verify_token(parts[1])
    except Exception as e:
        logger.warning("Optional user token verification could not be completed: %s", str(e))
        return None


def require_verified_user(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
    """
    Enforces authentication AND email verification before granting access.
    """
    if settings.REQUIRE_EMAIL_VERIFIED and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required before accessing this resource. Please check your inbox or resend verification.",
        )
    return user


def check_auth_rate_limit(request: Request):
    """
    Rate-limiting dependency for auth and sensitive endpoints.
    Protects against automated credential-stuffing and DOS attacks.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"{client_ip}:{request.url.path}"
    if not rate_limiter.is_allowed(key):
        logger.warning("Auth rate limit exceeded for client: %s on %s", client_ip, request.url.path)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication requests from this client. Please wait 60 seconds.",
            headers={"Retry-After": "60"},
        )
