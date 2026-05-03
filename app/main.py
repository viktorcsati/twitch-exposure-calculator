from fastapi import FastAPI

app = FastAPI(title='Twitch Exposure Calculator API')

@app.get('/')
async def root():
    return {'message': 'Twitch Exposure Calculator API is running'}

@app.get('/health')
async def health():
    return {'status': 'healthy'}
