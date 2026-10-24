import os
import re
import math
import json
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Optional
import httpx
from pydantic import BaseModel
from backend.app.config import settings
from backend.app.services.source_store import SourcePassage, source_store

logger = logging.getLogger("inkloom_retriever")


class RetrievedPassage(BaseModel):
    passage: SourcePassage
    score: int  # 0 to 100


def _tokenize(text: str) -> set[str]:
    """Tokenize and normalize text into alphanumeric words for deterministic retrieval."""
    words = re.findall(r"\b[a-zA-Z0-9_\-\.\%]+\b", text.lower())
    # Exclude common stop words
    stop_words = {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
        "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
        "to", "was", "were", "will", "with"
    }
    return {w for w in words if w not in stop_words and len(w) > 1}


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Computes cosine similarity between two float vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return (dot / (na * nb)) if na and nb else 0.0


class PassageRetriever:
    """
    Hybrid retrieval engine combining deterministic keyword matching with
    dense semantic embeddings via gemini-embedding-001.
    Gracefully degrades to pure deterministic keyword retrieval when offline or unconfigured.
    """
    CACHE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "embeddings_cache.json"

    def __init__(self, store=source_store):
        self.store = store
        self._embeddings_cache: Dict[str, List[float]] = {}
        self._load_embeddings_cache()

    def _load_embeddings_cache(self) -> None:
        """Loads cached passage embeddings from disk if available."""
        if self.CACHE_FILE.exists():
            try:
                with open(self.CACHE_FILE, "r", encoding="utf-8") as f:
                    self._embeddings_cache = json.load(f)
                logger.info("Loaded %d cached passage embeddings from disk.", len(self._embeddings_cache))
            except Exception as e:
                logger.warning("Could not read embeddings cache: %s", e)

    def _save_embeddings_cache(self) -> None:
        """Persists passage embeddings to disk."""
        try:
            self.CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(self.CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._embeddings_cache, f)
        except Exception as e:
            logger.warning("Could not save embeddings cache: %s", e)

    def _ensure_passage_embeddings(self, passages: List[SourcePassage]) -> None:
        """Generates embeddings for any new or missing source passages using gemini-embedding-001."""
        missing = [p for p in passages if p.passage_id not in self._embeddings_cache]
        if not missing:
            return

        if not (settings.is_llm_configured and settings.GEMINI_API_KEY):
            return

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={settings.GEMINI_API_KEY}"
            requests = [
                {
                    "model": "models/gemini-embedding-001",
                    "content": {"parts": [{"text": f"{p.source_title} - {p.section}: {p.text}"}]}
                }
                for p in missing
            ]
            resp = httpx.post(url, json={"requests": requests}, timeout=15.0)
            if resp.status_code == 200:
                data = resp.json()
                for i, emb in enumerate(data.get("embeddings", [])):
                    vals = emb.get("values", [])
                    if vals:
                        self._embeddings_cache[missing[i].passage_id] = vals
                self._save_embeddings_cache()
                logger.info("Generated and cached embeddings for %d passages.", len(missing))
        except Exception as e:
            logger.warning("Failed to embed missing passages: %s", e)

    def _embed_query(self, query: str) -> Optional[List[float]]:
        """Embeds a user query using gemini-embedding-001."""
        if not (settings.is_llm_configured and settings.GEMINI_API_KEY):
            return None
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={settings.GEMINI_API_KEY}"
            resp = httpx.post(url, json={"content": {"parts": [{"text": query}]}}, timeout=3.5)
            if resp.status_code == 200:
                return resp.json().get("embedding", {}).get("values")
        except Exception as e:
            logger.debug("Query embedding failed or timed out: %s", e)
        return None

    def retrieve(self, query: str, top_k: int = 3, min_score: int = 15) -> List[RetrievedPassage]:
        """
        Retrieves top_k relevant approved source passages using hybrid dense-sparse scoring.
        Falls back seamlessly to pure deterministic keyword retrieval when offline.
        """
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        passages = self.store.get_all_passages()
        if not passages:
            return []

        # Ensure passage embeddings are up to date
        self._ensure_passage_embeddings(passages)
        query_emb = self._embed_query(query)

        scored_passages: List[Tuple[SourcePassage, int]] = []

        for passage in passages:
            # 1. Sparse keyword & token overlap score (includes title, section, and text)
            full_passage_text = f"{passage.source_title} {passage.section} {passage.text}"
            passage_tokens = _tokenize(full_passage_text)
            overlap = query_tokens.intersection(passage_tokens)

            overlap_count = len(overlap)
            query_coverage = overlap_count / len(query_tokens) if query_tokens else 0
            passage_coverage = overlap_count / len(passage_tokens) if passage_tokens else 0

            number_boost = 0
            for token in overlap:
                if any(char.isdigit() for char in token) or "%" in token:
                    number_boost += 15

            raw_kw_score = int((query_coverage * 60) + (passage_coverage * 30) + number_boost)
            keyword_score = max(0, min(100, raw_kw_score))

            # 2. Dense semantic score (if embeddings are available)
            if query_emb and passage.passage_id in self._embeddings_cache:
                cos_sim = _cosine_similarity(query_emb, self._embeddings_cache[passage.passage_id])
                # Normalize cosine similarity (typically 0.35 to 0.85) to 0-100 range
                dense_score = int(min(100, max(0, (cos_sim - 0.35) / 0.45 * 100)))
                # Combine: 65% dense semantic + 35% sparse keyword
                final_score = int((dense_score * 0.65) + (keyword_score * 0.35))
            else:
                final_score = keyword_score

            if final_score >= min_score or (overlap_count > 0 and keyword_score >= min_score):
                scored_passages.append((passage, max(final_score, keyword_score)))

        # Sort descending by score
        scored_passages.sort(key=lambda x: x[1], reverse=True)

        return [
            RetrievedPassage(passage=p, score=s)
            for p, s in scored_passages[:top_k]
        ]

    def retrieve_for_draft(self, title: str, content: str, top_k: int = 8) -> List[RetrievedPassage]:
        """
        Retrieves relevant passages across the whole draft by querying title,
        sentences, and key phrases, aggregating and ranking results.
        """
        queries = [title]
        # Split content into sentences/chunks
        sentences = [s.strip() for s in re.split(r"[.\n\?!]+", content) if len(s.strip()) > 10]
        queries.extend(sentences[:8])

        passage_best_scores: Dict[str, Tuple[SourcePassage, int]] = {}
        for q in queries:
            results = self.retrieve(q, top_k=top_k, min_score=10)
            for r in results:
                pid = r.passage.passage_id
                if pid not in passage_best_scores or r.score > passage_best_scores[pid][1]:
                    passage_best_scores[pid] = (r.passage, r.score)

        sorted_passages = sorted(passage_best_scores.values(), key=lambda x: x[1], reverse=True)
        # If very few passages matched specific queries, fill in from general store passages
        if len(sorted_passages) < 4:
            all_passages = self.store.get_all_passages()
            existing_ids = {p.passage_id for p, _ in sorted_passages}
            for p in all_passages:
                if p.passage_id not in existing_ids:
                    sorted_passages.append((p, 20))
                if len(sorted_passages) >= top_k:
                    break

        return [RetrievedPassage(passage=p, score=s) for p, s in sorted_passages[:top_k]]


retriever = PassageRetriever()

