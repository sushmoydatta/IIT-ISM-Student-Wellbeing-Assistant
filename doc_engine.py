import os
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from datetime import datetime
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from groq import Groq
from dotenv import load_dotenv

from logger import chat_logger

class SimpleEmbedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        try:
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name
        except Exception as e:
            chat_logger.log_error(
                session_id="SYSTEM",
                error_type="ModelLoadError",
                error_message=f"Failed to load embedding model: {str(e)}",
                stack_trace=None
            )
            raise

    def embed(self, text: str) -> np.ndarray:
        try:
            return self.model.encode([text])[0]
        except Exception as e:
            chat_logger.log_error(
                session_id="SYSTEM",
                error_type="EmbeddingError",
                error_message=f"Failed to generate embedding: {str(e)}",
                stack_trace=None
            )
            raise

class GroqLLM:
    def __init__(
        self,
        model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: float = 0.7,
        max_tokens: int = 1024
    ):
        load_dotenv()
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY not found in environment variables")
        self.client = Groq(api_key=self.api_key)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def predict(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        try:
            start_time = datetime.now()
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=self.temperature,
                max_completion_tokens=self.max_tokens,
                top_p=1,
                stream=False,
                stop=None
            )
            response_time = (datetime.now() - start_time).total_seconds()
            metadata = {
                "model": self.model,
                "response_time": response_time,
                "token_count": len(completion.choices[0].message.content.split())
            }
            return completion.choices[0].message.content, metadata
        except Exception as e:
            await chat_logger.log_error(
                session_id="SYSTEM",
                error_type="LLMError",
                error_message=f"Failed to get LLM response: {str(e)}",
                stack_trace=None
            )
            raise

class DocumentSearchEngine:
    def __init__(self, data_dir: str = "data"):
        self.embedder = SimpleEmbedder()
        self.llm = GroqLLM()
        self.documents = SimpleDirectoryReader(data_dir).load_data()
        self.document_texts = [str(doc) for doc in self.documents]
        self.document_embeddings = None
        self._initialize_embeddings()

    def _initialize_embeddings(self):
        try:
            self.document_embeddings = [
                self.embedder.embed(text) for text in self.document_texts
            ]
        except Exception as e:
            chat_logger.log_error(
                session_id="SYSTEM",
                error_type="EmbeddingInitError",
                error_message=f"Failed to initialize embeddings: {str(e)}",
                stack_trace=None
            )
            raise

    async def query_documents(
        self,
        user_query: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        try:
            query_embedding = self.embedder.embed(user_query)
            similarities = cosine_similarity([query_embedding], self.document_embeddings)[0]
            best_match_index = int(np.argmax(similarities))
            best_document = self.document_texts[best_match_index]
            match_score = similarities[best_match_index]
            prompt = (
                f"Based on this document: {best_document}\n"
                f"Answer this query: {user_query}\n"
                "Provide a clear and empathetic response."
            )
            response, llm_metadata = await self.llm.predict(prompt, context)
            metadata = {
                **llm_metadata,
                "match_score": float(match_score),
                "document_index": best_match_index
            }
            return response, metadata
        except Exception as e:
            await chat_logger.log_error(
                session_id="SYSTEM",
                error_type="DocumentQueryError",
                error_message=f"Failed to query documents: {str(e)}",
                stack_trace=None
            )
            raise

search_engine = DocumentSearchEngine()

async def query_documents(
    user_query: str,
    context: Optional[Dict[str, Any]] = None
) -> str:
    response, _ = await search_engine.query_documents(user_query, context)
    return response

