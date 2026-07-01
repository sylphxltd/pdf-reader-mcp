# PDF Reader MCP — containerized runtime
# Provides a sandboxed, reproducible environment for the MCP server.
# stdio transport by default; HTTP transport available via MCP_TRANSPORT=http.

FROM node:22-slim

LABEL org.opencontainers.image.title="PDF Reader MCP"
LABEL org.opencontainers.image.description="V3 PDF intelligence MCP server with Agent Document Twin extraction"
LABEL org.opencontainers.image.source="https://github.com/SylphxAI/pdf-reader-mcp"
LABEL org.opencontainers.image.licenses="MIT"

# Install tesseract-ocr for optional OCR provider support
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the package globally so the bin is on PATH
RUN npm install -g @sylphx/pdf-reader-mcp

# Default working directory for PDF files mounted by the user
RUN mkdir -p /workspace
WORKDIR /workspace

# Environment defaults
ENV MCP_TRANSPORT=stdio
ENV MCP_HTTP_HOST=127.0.0.1
ENV MCP_HTTP_PORT=3000
ENV MCP_PDF_ALLOWED_DIRS=/workspace

EXPOSE 3000

ENTRYPOINT ["pdf-reader-mcp"]
