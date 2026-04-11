$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/distributor_pay?schema=public'
$env:JWT_SECRET = '7f8b9d2a1c4e6f5a3c2b1d4e7f8a9c0b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a'
$env:CORS_ORIGINS = 'http://localhost:5001,http://localhost:5002,http://localhost:5003'
$env:REDIS_URL = 'redis://localhost:6379'
$env:AUTH_COOKIE_SECURE = 'false'
$env:NODE_ENV = 'development'

Set-Location 'D:\Sinhe\api\apps\api'
node dist/main.js
