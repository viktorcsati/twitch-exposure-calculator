# Twitch Exposure Calculator

A sophisticated dashboard to calculate the most beneficial Twitch category to stream in for maximum discoverability and growth.

## 🚀 Features
- **Real-time Metrics:** Fetches live data from the Twitch Helix API.
- **Discoverability Scoring:** Uses a custom algorithm to calculate an "Opportunity Score" based on viewer distribution and saturation.
- **Twitch Sync:** Automatically pulls your current average viewer count to tailor recommendations to your channel size.
- **Gaming Filters:** Toggle between all categories or gaming-only categories.
- **One-Click Updates:** Update both the application code (from Git) and the data metrics directly from the UI.
- **Proxmox Optimized:** Designed to run in an LXC container with Docker.

## 🛠 Installation (Proxmox LXC)

1.  **Create an LXC Container** (Debian/Ubuntu recommended) with **Nesting** and **Keyctl** enabled in Options > Features.
2.  **Install Docker:**
    ```bash
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
    ```
3.  **Clone & Setup:**
    ```bash
    git clone https://github.com/viktorcsati/twitch-exposure-calculator.git /opt/twitch-exposure
    cd /opt/twitch-exposure
    cp .env.example .env
    ```
4.  **Configure `.env`:** Add your Twitch Client ID, Secret, and Channel Name.
5.  **Launch:**
    ```bash
    docker compose up -d --build
    ```

## 🔄 Updating
- **Data Update:** Click the **"Refresh Metrics"** button in the dashboard sidebar.
- **App Update:** Click the **"Update App Code"** button in the sidebar. This will pull the latest code from GitHub and rebuild the containers automatically.

## ⚖️ License
MIT License - Copyright (c) 2026 viktorcsati
