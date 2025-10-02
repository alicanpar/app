from fastapi import FastAPI, APIRouter, HTTPException, Depends, Cookie, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    fitness_goals: Optional[List[str]] = []
    experience_level: Optional[str] = "beginner"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Exercise(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str  # strength, cardio, flexibility
    muscle_groups: List[str]
    instructions: str
    difficulty: str  # beginner, intermediate, advanced
    equipment: Optional[str] = None
    
class WorkoutExercise(BaseModel):
    exercise_id: str
    sets: Optional[int] = 0
    reps: Optional[int] = 0
    weight: Optional[float] = 0.0
    duration: Optional[int] = 0  # in seconds
    rest_time: Optional[int] = 60  # in seconds
    notes: Optional[str] = ""

class Workout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    date: datetime
    exercises: List[WorkoutExercise]
    duration: Optional[int] = 0  # total workout duration in minutes
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Progress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: datetime
    weight: Optional[float] = None
    body_fat: Optional[float] = None
    measurements: Optional[dict] = {}
    notes: Optional[str] = ""
    
class AIConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    messages: List[dict]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkoutCreate(BaseModel):
    name: str
    exercises: List[WorkoutExercise]
    notes: Optional[str] = ""

class ProgressCreate(BaseModel):
    weight: Optional[float] = None
    body_fat: Optional[float] = None
    measurements: Optional[dict] = {}
    notes: Optional[str] = ""

class AIQuestion(BaseModel):
    question: str
    context: Optional[dict] = {}

# Helper function to get current user from session
async def get_current_user(session_token: Optional[str] = Cookie(None)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if session exists and is valid
    session = await db.user_sessions.find_one({
        "session_token": session_token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user)

# Initialize exercise database
async def initialize_exercises():
    existing = await db.exercises.find_one({})
    if existing:
        return
    
    sample_exercises = [
        {
            "id": str(uuid.uuid4()),
            "name": "Push-ups",
            "category": "strength",
            "muscle_groups": ["chest", "triceps", "shoulders"],
            "instructions": "Start in plank position, lower body until chest nearly touches floor, push back up.",
            "difficulty": "beginner",
            "equipment": "bodyweight"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Squats",
            "category": "strength",
            "muscle_groups": ["quadriceps", "glutes", "hamstrings"],
            "instructions": "Stand with feet shoulder-width apart, lower body as if sitting back into chair, return to standing.",
            "difficulty": "beginner",
            "equipment": "bodyweight"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Deadlift",
            "category": "strength",
            "muscle_groups": ["hamstrings", "glutes", "lower back"],
            "instructions": "Stand with feet hip-width apart, bend at hips and knees to grip barbell, lift by extending hips and knees.",
            "difficulty": "intermediate",
            "equipment": "barbell"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Running",
            "category": "cardio",
            "muscle_groups": ["legs", "cardiovascular"],
            "instructions": "Maintain steady pace, proper form with slight forward lean, land on midfoot.",
            "difficulty": "beginner",
            "equipment": "none"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plank",
            "category": "strength",
            "muscle_groups": ["core", "shoulders"],
            "instructions": "Hold body in straight line from head to heels, engage core muscles.",
            "difficulty": "beginner",
            "equipment": "bodyweight"
        }
    ]
    
    await db.exercises.insert_many(sample_exercises)

# Authentication routes
@api_router.get("/auth/session-data")
async def get_session_data(x_session_id: str = None):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Call Emergent auth service
    try:
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": x_session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session")
        
        user_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]})
        
        if not existing_user:
            # Create new user
            user = User(
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data["picture"]
            )
            await db.users.insert_one(user.dict())
        else:
            user = User(**existing_user)
        
        # Create session
        session_token = user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session = UserSession(
            session_token=session_token,
            user_id=user.id,
            expires_at=expires_at
        )
        
        await db.user_sessions.insert_one(session.dict())
        
        return {
            "user": user.dict(),
            "session_token": session_token
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user), session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    return {"message": "Logged out successfully"}

# Exercise routes
@api_router.get("/exercises", response_model=List[Exercise])
async def get_exercises(category: Optional[str] = None, difficulty: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    
    exercises = await db.exercises.find(query).to_list(length=None)
    return [Exercise(**exercise) for exercise in exercises]

# Workout routes
@api_router.post("/workouts", response_model=Workout)
async def create_workout(workout_data: WorkoutCreate, current_user: User = Depends(get_current_user)):
    workout = Workout(
        user_id=current_user.id,
        name=workout_data.name,
        date=datetime.now(timezone.utc),
        exercises=workout_data.exercises,
        notes=workout_data.notes
    )
    
    await db.workouts.insert_one(workout.dict())
    return workout

@api_router.get("/workouts", response_model=List[Workout])
async def get_workouts(current_user: User = Depends(get_current_user), limit: int = 20):
    workouts = await db.workouts.find(
        {"user_id": current_user.id}
    ).sort("date", -1).limit(limit).to_list(length=None)
    
    return [Workout(**workout) for workout in workouts]

@api_router.get("/workouts/{workout_id}", response_model=Workout)
async def get_workout(workout_id: str, current_user: User = Depends(get_current_user)):
    workout = await db.workouts.find_one({
        "id": workout_id,
        "user_id": current_user.id
    })
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return Workout(**workout)

# Progress tracking routes
@api_router.post("/progress", response_model=Progress)
async def add_progress(progress_data: ProgressCreate, current_user: User = Depends(get_current_user)):
    progress = Progress(
        user_id=current_user.id,
        date=datetime.now(timezone.utc),
        weight=progress_data.weight,
        body_fat=progress_data.body_fat,
        measurements=progress_data.measurements,
        notes=progress_data.notes
    )
    
    await db.progress.insert_one(progress.dict())
    return progress

@api_router.get("/progress", response_model=List[Progress])
async def get_progress(current_user: User = Depends(get_current_user), days: int = 90):
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    progress_data = await db.progress.find({
        "user_id": current_user.id,
        "date": {"$gte": start_date}
    }).sort("date", -1).to_list(length=None)
    
    return [Progress(**p) for p in progress_data]

# AI Coach routes
@api_router.post("/ai/ask")
async def ask_ai_coach(question_data: AIQuestion, current_user: User = Depends(get_current_user)):
    try:
        # Get user's recent workouts for context
        recent_workouts = await db.workouts.find(
            {"user_id": current_user.id}
        ).sort("date", -1).limit(5).to_list(length=None)
        
        # Get user's recent progress
        recent_progress = await db.progress.find(
            {"user_id": current_user.id}
        ).sort("date", -1).limit(3).to_list(length=None)
        
        # Build context for AI
        context = f"""
You are an expert fitness coach and personal trainer. Help the user with their fitness journey.

User Profile:
- Name: {current_user.name}
- Experience Level: {current_user.experience_level}
- Fitness Goals: {', '.join(current_user.fitness_goals) if current_user.fitness_goals else 'Not specified'}

Recent Workout History:
{str(recent_workouts) if recent_workouts else 'No recent workouts'}

Recent Progress:
{str(recent_progress) if recent_progress else 'No recent progress data'}

Provide helpful, encouraging, and safe fitness advice. Always recommend consulting with healthcare professionals for medical concerns.
"""
        
        # Initialize AI chat
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"fitness_coach_{current_user.id}",
            system_message=context
        ).with_model("openai", "gpt-4o")
        
        # Send message
        user_message = UserMessage(text=question_data.question)
        response = await chat.send_message(user_message)
        
        # Save conversation
        conversation = AIConversation(
            user_id=current_user.id,
            session_id=f"fitness_coach_{current_user.id}",
            messages=[
                {"role": "user", "content": question_data.question, "timestamp": datetime.now(timezone.utc).isoformat()},
                {"role": "assistant", "content": response, "timestamp": datetime.now(timezone.utc).isoformat()}
            ]
        )
        
        await db.ai_conversations.insert_one(conversation.dict())
        
        return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

# User profile routes
@api_router.get("/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/profile")
async def update_profile(fitness_goals: Optional[List[str]] = None, 
                        experience_level: Optional[str] = None,
                        current_user: User = Depends(get_current_user)):
    update_data = {}
    if fitness_goals is not None:
        update_data["fitness_goals"] = fitness_goals
    if experience_level is not None:
        update_data["experience_level"] = experience_level
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated successfully"}

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    # Get total workouts
    total_workouts = await db.workouts.count_documents({"user_id": current_user.id})
    
    # Get workouts this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    workouts_this_week = await db.workouts.count_documents({
        "user_id": current_user.id,
        "date": {"$gte": week_ago}
    })
    
    # Get latest progress
    latest_progress = await db.progress.find_one(
        {"user_id": current_user.id},
        sort=[("date", -1)]
    )
    
    # Get recent workouts
    recent_workouts = await db.workouts.find(
        {"user_id": current_user.id}
    ).sort("date", -1).limit(3).to_list(length=None)
    
    return {
        "total_workouts": total_workouts,
        "workouts_this_week": workouts_this_week,
        "latest_progress": Progress(**latest_progress).dict() if latest_progress else None,
        "recent_workouts": [Workout(**w).dict() for w in recent_workouts]
    }

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "Fitness Tracker API"}

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize data on startup
@app.on_event("startup")
async def startup_event():
    await initialize_exercises()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
