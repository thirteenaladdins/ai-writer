# AI Writer

An AI-powered writing tool with a VS Code-like interface, built with SvelteKit and FastAPI.

## Project Structure

- `frontend/`: SvelteKit frontend application
- `backend/`: FastAPI backend application

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```

The backend will be available at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at http://localhost:5173

## Features

- VS Code-like interface with three panels:
  - Left panel: Plot lines and story structure
  - Center panel: Text editor
  - Right panel: AI chat assistant
- Document management
- Plot line tracking
- AI-powered writing assistance

## Development

- Backend API documentation: http://localhost:8000/docs
- Frontend hot-reload enabled for development 