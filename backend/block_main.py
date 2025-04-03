from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import block_handlers

app = FastAPI(title="Block-based Document Editor API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include block-based document routes
app.include_router(
    block_handlers.router,
    prefix="/api/v1",
    tags=["block-documents"]
)


@app.get("/")
def read_root():
    return {"message": "Block-based Document Editor API"}
