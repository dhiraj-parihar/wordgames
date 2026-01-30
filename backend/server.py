from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Optional, List
import uuid
import asyncio
import random
from datetime import datetime, timezone
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Game constants
START_HP = 100
MATCH_DURATION = 60
COMBO_THRESHOLD = 5
FAST_WORD_THRESHOLD = 1.5  # seconds per word

# Text pool for matches
TEXT_POOL = [
    "The quick brown fox jumps over the lazy dog while carrying a heavy backpack through the forest.",
    "Artificial intelligence systems are transforming how we interact with technology in our daily lives.",
    "Professional gamers practice their skills for hours every day to compete at the highest level.",
    "Mountain climbers face extreme weather conditions and dangerous terrain on their expeditions.",
    "Modern architecture combines functionality with aesthetic design to create beautiful spaces.",
    "Scientists conduct experiments to discover new knowledge about the natural world and universe.",
    "Musicians spend years mastering their instruments to perform complex compositions flawlessly.",
    "Athletes train rigorously to improve their speed strength and endurance for competition.",
    "Writers craft stories that transport readers to different worlds and spark imagination.",
    "Engineers design innovative solutions to solve complex technical problems efficiently."
]

# Models
class Player(BaseModel):
    model_config = ConfigDict(extra="ignore")
    username: str
    rank: int = 1000
    rank_name: str = "Bronze"
    wins: int = 0
    losses: int = 0

class PlayerCreate(BaseModel):
    username: str

class PlayerUpdate(BaseModel):
    rank: int
    rank_name: str
    wins: int
    losses: int

class MatchResult(BaseModel):
    winner: str
    loser: str
    winner_accuracy: float
    loser_accuracy: float

# In-memory game state
class GameState:
    def __init__(self):
        self.matchmaking_queue: List[Dict] = []
        self.active_matches: Dict[str, Dict] = {}
        self.player_connections: Dict[str, WebSocket] = {}
        self.player_to_match: Dict[str, str] = {}
    
    def add_to_queue(self, username: str, ws: WebSocket):
        self.matchmaking_queue.append({"username": username, "ws": ws})
        self.player_connections[username] = ws
    
    def remove_from_queue(self, username: str):
        self.matchmaking_queue = [p for p in self.matchmaking_queue if p["username"] != username]
        self.player_connections.pop(username, None)
    
    def create_match(self, player1: str, player2: str) -> str:
        match_id = str(uuid.uuid4())
        text = random.choice(TEXT_POOL)
        
        self.active_matches[match_id] = {
            "match_id": match_id,
            "text": text,
            "players": {
                player1: {
                    "username": player1,
                    "hp": START_HP,
                    "shields": 0,
                    "combo": 0,
                    "typed": "",
                    "words_completed": 0,
                    "accuracy": 100.0,
                    "correct_chars": 0,
                    "total_chars": 0,
                    "word_times": []
                },
                player2: {
                    "username": player2,
                    "hp": START_HP,
                    "shields": 0,
                    "combo": 0,
                    "typed": "",
                    "words_completed": 0,
                    "accuracy": 100.0,
                    "correct_chars": 0,
                    "total_chars": 0,
                    "word_times": []
                }
            },
            "start_time": None,
            "status": "countdown"
        }
        
        self.player_to_match[player1] = match_id
        self.player_to_match[player2] = match_id
        
        return match_id
    
    def get_match(self, match_id: str) -> Optional[Dict]:
        return self.active_matches.get(match_id)
    
    def get_player_match(self, username: str) -> Optional[Dict]:
        match_id = self.player_to_match.get(username)
        if match_id:
            return self.active_matches.get(match_id)
        return None
    
    def remove_match(self, match_id: str):
        match = self.active_matches.pop(match_id, None)
        if match:
            for player in match["players"].keys():
                self.player_to_match.pop(player, None)

game_state = GameState()

def get_rank_name(rank: int) -> str:
    if rank < 1200:
        return "Bronze"
    elif rank < 1400:
        return "Silver"
    elif rank < 1600:
        return "Gold"
    else:
        return "Diamond"

# REST endpoints
@api_router.post("/player", response_model=Player)
async def create_player(player_data: PlayerCreate):
    existing = await db.players.find_one({"username": player_data.username}, {"_id": 0})
    if existing:
        return Player(**existing)
    
    player = Player(username=player_data.username)
    doc = player.model_dump()
    await db.players.insert_one(doc)
    return player

@api_router.get("/player/{username}", response_model=Player)
async def get_player(username: str):
    player = await db.players.find_one({"username": username}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return Player(**player)

@api_router.get("/leaderboard", response_model=List[Player])
async def get_leaderboard():
    players = await db.players.find({}, {"_id": 0}).sort("rank", -1).limit(10).to_list(10)
    return [Player(**p) for p in players]

# WebSocket endpoint
@api_router.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await websocket.accept()
    logger.info(f"WebSocket connected: {username}")
    
    game_state.player_connections[username] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "join_queue":
                game_state.add_to_queue(username, websocket)
                logger.info(f"{username} joined queue. Queue size: {len(game_state.matchmaking_queue)}")
                
                await websocket.send_json({
                    "type": "queue_joined",
                    "queue_size": len(game_state.matchmaking_queue)
                })
                
                # Try matchmaking
                if len(game_state.matchmaking_queue) >= 2:
                    player1_data = game_state.matchmaking_queue.pop(0)
                    player2_data = game_state.matchmaking_queue.pop(0)
                    
                    player1 = player1_data["username"]
                    player2 = player2_data["username"]
                    ws1 = player1_data["ws"]
                    ws2 = player2_data["ws"]
                    
                    match_id = game_state.create_match(player1, player2)
                    match = game_state.get_match(match_id)
                    
                    logger.info(f"Match created: {match_id} - {player1} vs {player2}")
                    
                    # Send match found to both players
                    await ws1.send_json({
                        "type": "match_found",
                        "match_id": match_id,
                        "opponent": player2,
                        "text": match["text"],
                        "your_side": "player1"
                    })
                    
                    await ws2.send_json({
                        "type": "match_found",
                        "match_id": match_id,
                        "opponent": player1,
                        "text": match["text"],
                        "your_side": "player2"
                    })
                    
                    # Start countdown
                    asyncio.create_task(start_match_countdown(match_id))
            
            elif action == "keystroke":
                match = game_state.get_player_match(username)
                if not match or match["status"] != "active":
                    continue
                
                player_state = match["players"][username]
                opponent_name = [p for p in match["players"].keys() if p != username][0]
                opponent_state = match["players"][opponent_name]
                
                typed_text = data.get("typed", "")
                target_text = match["text"]
                
                # Update player state
                player_state["typed"] = typed_text
                player_state["total_chars"] = len(typed_text)
                
                # Calculate accuracy
                correct_chars = sum(1 for i, c in enumerate(typed_text) if i < len(target_text) and c == target_text[i])
                player_state["correct_chars"] = correct_chars
                
                if player_state["total_chars"] > 0:
                    player_state["accuracy"] = (correct_chars / player_state["total_chars"]) * 100
                
                # Check if last character was correct
                if len(typed_text) > 0 and len(typed_text) <= len(target_text):
                    last_char_correct = typed_text[-1] == target_text[len(typed_text) - 1]
                    
                    if last_char_correct:
                        player_state["combo"] += 1
                        
                        # Shield generation
                        if player_state["combo"] >= COMBO_THRESHOLD and player_state["combo"] % COMBO_THRESHOLD == 0:
                            player_state["shields"] += 1
                            
                            # Notify player of shield gain
                            await websocket.send_json({
                                "type": "shield_gained",
                                "shields": player_state["shields"]
                            })
                    else:
                        # Typo resets combo
                        player_state["combo"] = 0
                
                # Check for completed words
                words_in_target = target_text.split()
                words_typed = typed_text.split()
                
                current_words_completed = len([w for i, w in enumerate(words_typed) if i < len(words_in_target) and w == words_in_target[i]])
                
                if current_words_completed > player_state["words_completed"]:
                    # New word completed - send attack
                    word_length = len(words_typed[player_state["words_completed"]])
                    damage = 1
                    
                    # Long word bonus
                    if word_length > 7:
                        damage += 1
                    
                    # Apply damage to opponent
                    if opponent_state["shields"] > 0:
                        opponent_state["shields"] -= 1
                        # Notify shield block
                        opponent_ws = game_state.player_connections.get(opponent_name)
                        if opponent_ws:
                            await opponent_ws.send_json({
                                "type": "shield_blocked",
                                "shields": opponent_state["shields"]
                            })
                    else:
                        opponent_state["hp"] = max(0, opponent_state["hp"] - damage)
                        # Notify damage
                        opponent_ws = game_state.player_connections.get(opponent_name)
                        if opponent_ws:
                            await opponent_ws.send_json({
                                "type": "damage_taken",
                                "damage": damage,
                                "hp": opponent_state["hp"]
                            })
                    
                    # Notify attacker
                    await websocket.send_json({
                        "type": "attack_sent",
                        "damage": damage
                    })
                    
                    player_state["words_completed"] = current_words_completed
                
                # Broadcast game state
                await broadcast_game_state(match)
                
                # Check for KO
                if opponent_state["hp"] <= 0:
                    await end_match(match["match_id"], username, "ko")
            
            elif action == "leave_queue":
                game_state.remove_from_queue(username)
                await websocket.send_json({"type": "queue_left"})
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {username}")
        game_state.remove_from_queue(username)
        
        # Handle disconnect during match
        match = game_state.get_player_match(username)
        if match:
            opponent_name = [p for p in match["players"].keys() if p != username][0]
            await end_match(match["match_id"], opponent_name, "disconnect")
    
    except Exception as e:
        logger.error(f"WebSocket error for {username}: {str(e)}")
        game_state.remove_from_queue(username)

async def start_match_countdown(match_id: str):
    match = game_state.get_match(match_id)
    if not match:
        return
    
    # 3 second countdown
    for i in range(3, 0, -1):
        for username in match["players"].keys():
            ws = game_state.player_connections.get(username)
            if ws:
                await ws.send_json({
                    "type": "countdown",
                    "count": i
                })
        await asyncio.sleep(1)
    
    # Start match
    match["status"] = "active"
    match["start_time"] = datetime.now(timezone.utc)
    
    for username in match["players"].keys():
        ws = game_state.player_connections.get(username)
        if ws:
            await ws.send_json({
                "type": "match_started"
            })
    
    # Start match timer
    asyncio.create_task(match_timer(match_id))

async def match_timer(match_id: str):
    await asyncio.sleep(MATCH_DURATION)
    
    match = game_state.get_match(match_id)
    if not match or match["status"] != "active":
        return
    
    # Determine winner by HP
    players = list(match["players"].keys())
    player1_hp = match["players"][players[0]]["hp"]
    player2_hp = match["players"][players[1]]["hp"]
    
    if player1_hp > player2_hp:
        await end_match(match_id, players[0], "time")
    elif player2_hp > player1_hp:
        await end_match(match_id, players[1], "time")
    else:
        # Tie - higher accuracy wins
        player1_acc = match["players"][players[0]]["accuracy"]
        player2_acc = match["players"][players[1]]["accuracy"]
        
        if player1_acc > player2_acc:
            await end_match(match_id, players[0], "time")
        else:
            await end_match(match_id, players[1], "time")

async def end_match(match_id: str, winner_name: str, reason: str):
    match = game_state.get_match(match_id)
    if not match:
        return
    
    match["status"] = "ended"
    
    players = list(match["players"].keys())
    loser_name = [p for p in players if p != winner_name][0]
    
    winner_state = match["players"][winner_name]
    loser_state = match["players"][loser_name]
    
    # Calculate rank changes
    winner_rank_change = 25
    loser_rank_change = -15
    
    # Accuracy bonus
    if winner_state["accuracy"] >= 95.0:
        winner_rank_change += 5
    
    # Disconnect penalty
    if reason == "disconnect":
        loser_rank_change = -30
    
    # Update player ranks
    winner_player = await db.players.find_one({"username": winner_name}, {"_id": 0})
    loser_player = await db.players.find_one({"username": loser_name}, {"_id": 0})
    
    if winner_player:
        new_winner_rank = winner_player["rank"] + winner_rank_change
        await db.players.update_one(
            {"username": winner_name},
            {"$set": {
                "rank": new_winner_rank,
                "rank_name": get_rank_name(new_winner_rank),
                "wins": winner_player["wins"] + 1
            }}
        )
    
    if loser_player:
        new_loser_rank = max(800, loser_player["rank"] + loser_rank_change)
        await db.players.update_one(
            {"username": loser_name},
            {"$set": {
                "rank": new_loser_rank,
                "rank_name": get_rank_name(new_loser_rank),
                "losses": loser_player["losses"] + 1
            }}
        )
    
    # Send match results
    winner_ws = game_state.player_connections.get(winner_name)
    loser_ws = game_state.player_connections.get(loser_name)
    
    if winner_ws:
        await winner_ws.send_json({
            "type": "match_ended",
            "result": "victory",
            "reason": reason,
            "rank_change": winner_rank_change,
            "new_rank": new_winner_rank if winner_player else 1000,
            "rank_name": get_rank_name(new_winner_rank if winner_player else 1000),
            "accuracy": winner_state["accuracy"],
            "final_hp": winner_state["hp"]
        })
    
    if loser_ws:
        await loser_ws.send_json({
            "type": "match_ended",
            "result": "defeat",
            "reason": reason,
            "rank_change": loser_rank_change,
            "new_rank": new_loser_rank if loser_player else 1000,
            "rank_name": get_rank_name(new_loser_rank if loser_player else 1000),
            "accuracy": loser_state["accuracy"],
            "final_hp": loser_state["hp"]
        })
    
    # Remove match
    game_state.remove_match(match_id)

async def broadcast_game_state(match: Dict):
    for username, player_state in match["players"].items():
        ws = game_state.player_connections.get(username)
        if ws:
            opponent_name = [p for p in match["players"].keys() if p != username][0]
            opponent_state = match["players"][opponent_name]
            
            await ws.send_json({
                "type": "game_state",
                "player": {
                    "hp": player_state["hp"],
                    "shields": player_state["shields"],
                    "combo": player_state["combo"],
                    "accuracy": round(player_state["accuracy"], 1),
                    "typed": player_state["typed"]
                },
                "opponent": {
                    "hp": opponent_state["hp"],
                    "shields": opponent_state["shields"],
                    "combo": opponent_state["combo"],
                    "accuracy": round(opponent_state["accuracy"], 1),
                    "typed": opponent_state["typed"]
                }
            })

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
