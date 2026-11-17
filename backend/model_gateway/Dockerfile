FROM debian:bookworm-slim AS llama-build
RUN apt-get update && apt-get install -y --no-install-recommends git cmake build-essential libssl-dev && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch b12444 https://github.com/ggml-org/llama.cpp.git /llama && test "$(git -C /llama rev-parse HEAD)" = "47fe1333180210d01b000f9da614ea272f2f04c3" && cmake -S /llama -B /llama/build -DGGML_CUDA=OFF -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF -DGGML_NATIVE=OFF && cmake --build /llama/build --config Release -j 4 --target llama-completion
FROM python:3.13-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.10.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir fastapi==0.136.0 uvicorn==0.45.0 pydantic==2.12.5 onnxruntime==1.24.4 transformers==5.5.0 laya==0.3.9 numpy psutil tokenizers
COPY --from=llama-build /llama/build/bin/llama-completion /usr/local/bin/llama-completion
COPY --from=llama-build /llama/build/bin/*.so* /usr/local/lib/
RUN ldconfig && useradd --create-home --uid 10001 masar
COPY backend /app/backend
RUN mkdir -p /app/.cache /app/infrastructure/model_artifacts && chown -R masar:masar /app
USER masar
ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 CUDA_VISIBLE_DEVICES="" MODEL_THREADS=4
CMD ["uvicorn","backend.model_gateway.app:app","--host","0.0.0.0","--port","8001","--workers","1","--no-access-log"]
