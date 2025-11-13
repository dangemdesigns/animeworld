# 🏮 Echoes of the Lantern - Passive MMORPG

A peaceful, text-based passive MMORPG where reincarnated souls find their way home. Watch as heroes from players around the world embark on adventures automatically while you enjoy reading their stories unfold.

## ✨ Features

### Core Gameplay
- **Passive Gameplay**: Heroes adventure automatically - perfect for casual gamers
- **Offline Progress**: Your heroes keep working even when you're away (up to 12 hours)
- **Unlimited Progression**: No level caps, endless growth
- **Text-Based**: Rich, descriptive activity logs tell the story

### Multiplayer Features
- **Global Activity Feed**: See what ALL players' heroes are doing in real-time
- **No Direct Interaction**: Peaceful, stress-free social experience
- **Real-Time Updates**: Watch the world come alive with Socket.io
- **Account System**: Your progress is saved server-side

### Technical
- **Lightweight**: Simple, stable codebase
- **Local First**: Runs on localhost for development
- **SQLite Database**: Easy setup, no external database needed
- **RESTful API**: Clean backend architecture

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- A web browser (Chrome, Firefox, Safari, or Edge)
- Terminal/Command Prompt

### Step 1: Install Node.js Dependencies

Open your terminal in the project directory and run:

```bash
cd server
npm install
```

This will install all required packages:
- express (web server)
- socket.io (real-time communication)
- better-sqlite3 (database)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)
- cors (cross-origin requests)

### Step 2: Start the Server

While in the `server` directory, run:

```bash
npm start
```

You should see:

```
🏮 ====================================
   Echoes of the Lantern - Server
🏮 ====================================

📡 Server running on: http://localhost:8080
🎮 Game engine: Active
🗄️ Database: SQLite (local)

✅ Server is ready!
```

### Step 3: Open the Game

Open your web browser and go to:

```
http://localhost:8080
```

### Step 4: Create an Account

1. Click "Register" on the login screen
2. Enter a username, email, and password
3. Click "Register" button
4. You're in! Start summoning heroes

## 🎮 How to Play

### Getting Started

1. **Summon Your First Hero** (costs 50 gold, you start with 100)
   - Click the "Summon Hero" button
   - Each hero has a random name and class
   - Heroes start adventuring automatically!

2. **Watch the Global Feed**
   - See your heroes AND other players' heroes in action
   - Read about their adventures, battles, and discoveries
   - Switch between "Global" and "My Activities" tabs

3. **Let It Run**
   - Heroes continue adventuring even when you close the tab
   - Come back later to see what you missed
   - Earn gold and experience passively

### Gameplay Loop

1. Heroes automatically choose activities (Resting, Exploring, Hunting, Gathering)
2. Activities complete after a few seconds
3. Heroes earn gold and experience
4. Heroes level up automatically
5. Use gold to summon more heroes
6. Read the activity log to enjoy the stories

### Offline Progress

- When you log back in after being away, you'll receive gold for the time you were gone
- Maximum offline progress: 12 hours
- Rate: 10 gold per hour

## 📁 Project Structure

```
animeworld/
├── index.html                    # Main game page
├── server/
│   ├── server.js                 # Main server file
│   ├── package.json              # Dependencies
│   ├── echoes-of-lantern.db      # SQLite database (auto-created)
│   ├── config/
│   │   └── database.js           # Database setup
│   ├── models/
│   │   ├── User.js               # User operations
│   │   ├── Hero.js               # Hero operations
│   │   └── ActivityLog.js        # Activity logging
│   ├── controllers/
│   │   ├── authController.js     # Login/register
│   │   └── gameController.js     # Game actions
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints
│   │   └── game.js               # Game endpoints
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   └── utils/
│       └── gameEngine.js         # Automatic hero activities
├── src/
│   ├── core/
│   │   ├── api.js                # API client
│   │   └── multiplayer.js        # Main game logic
│   ├── assets/css/
│   │   └── style.css             # All styles
│   └── data/
│       ├── classes.json          # Hero classes
│       ├── heroNames.json        # Name generation
│       └── activities.json       # Activity types
└── README.md                     # This file
```

## 🛠️ Development

### Running in Development Mode

The server automatically reloads when you make changes:

```bash
cd server
npm run dev
```

### Database Location

The SQLite database is created automatically at:
```
server/echoes-of-lantern.db
```

To reset the database, simply delete this file and restart the server.

### API Endpoints

**Authentication:**
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

**Game:**
- `POST /api/game/heroes/summon` - Summon new hero
- `GET /api/game/heroes` - Get user's heroes
- `GET /api/game/feed/global` - Global activity feed
- `GET /api/game/feed/user` - User's activity feed
- `GET /api/game/leaderboard` - Get leaderboards
- `GET /api/game/stats` - Get game statistics

### Socket.io Events

**Client → Server:**
- `authenticate` - Authenticate user
- `request_global_feed` - Request activity feed

**Server → Client:**
- `hero_activity_start` - Hero started activity
- `hero_activity_complete` - Hero completed activity
- `user_data_update` - User data changed
- `online_users_update` - Online user count changed
- `global_feed_update` - New activities available

## 🌐 Deploying Online

### Option 1: Free Hosting (Railway/Render)

1. Push code to GitHub
2. Create account on Railway.app or Render.com
3. Connect your GitHub repository
4. Set environment variables (if needed)
5. Deploy!

### Option 2: VPS (DigitalOcean, etc.)

1. Set up a Linux server
2. Install Node.js
3. Clone your repository
4. Run `npm install` in server directory
5. Use PM2 to keep server running:
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name echoes-of-lantern
   pm2 save
   pm2 startup
   ```

### Switching from SQLite to PostgreSQL (for production)

For production with many users, consider switching to PostgreSQL:

1. Install `pg` package: `npm install pg`
2. Update `server/config/database.js` to use PostgreSQL
3. Update queries to use PostgreSQL syntax

## 🎨 Design Philosophy

- **Passive First**: Minimal player input, maximum enjoyment
- **Text-Based**: Stories > Graphics
- **No Pressure**: No timers, no competition, no stress
- **Social by Observation**: See others without direct interaction
- **Unlimited Progress**: Play for years if you want

## 📝 Future Features (Not Yet Implemented)

- Global boss events
- Guild system
- Marketplace
- More hero classes and activities
- Region exploration
- Hero retirement system
- Achievement system

## 🐛 Troubleshooting

### Server won't start
- Make sure Node.js is installed: `node --version`
- Check if port 8080 is already in use
- Delete `node_modules` and run `npm install` again

### Can't connect to server
- Make sure server is running (check terminal)
- Try `http://localhost:8080` not `https://`
- Check browser console for errors (F12)

### Database errors
- Delete `server/echoes-of-lantern.db` and restart server
- This will reset all data but fix corruption issues

### "Module not found" errors
- Run `npm install` in the `server` directory
- Make sure you're using Node.js v18 or higher

## 📄 License

This project is open source and available for personal use.

## 🤝 Contributing

This is a personal project, but feel free to fork and modify for your own use!

---

**Enjoy your journey as a Haven Keeper!** 🏮✨

*Remember: The best games are the ones you don't have to actively play.*
