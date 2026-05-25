#!/bin/bash

### Run Docker, then Run Application, then Run testing.sh 

# ============================================
# 0. ENABLE PROMETHEUS PLUGIN
# ============================================
curl -s -X POST http://localhost:8001/plugins \
  -H "Content-Type: application/json" \
  -d '{"name":"prometheus","config":{"status_code_metrics":true,"latency_metrics":true}}' > /dev/null

# ============================================
# 0.1 LIST AVAILABLE PLUGINS
# ============================================
curl -s http://localhost:8001/plugins | jq '.data[] | {name: .name, id: .id, enabled: .enabled}' 2>/dev/null

# ============================================
# 1. CREATE SERVICES
# ============================================

# Create a user-api service
curl -s -X POST http://localhost:3000/kong/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-api",
    "url": "http://httpbin.org"
  }' > /dev/null

# Create an auth-api service
curl -s -X POST http://localhost:3000/kong/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "auth-api",
    "url": "http://httpbin.org"
  }' > /dev/null

# Create a payment-api service
curl -s -X POST http://localhost:3000/kong/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-api",
    "url": "http://httpbin.org"
  }' > /dev/null

# ============================================
# 2. CREATE ROUTES
# ============================================

# Create route for user-api (/api/users)
curl -s -X POST http://localhost:3000/kong/services/user-api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/api/users"],
    "name": "users-route",
    "methods": ["GET", "POST"]
  }' > /dev/null

# Create route for auth-api (/api/auth)
curl -s -X POST http://localhost:3000/kong/services/auth-api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/api/auth"],
    "name": "auth-route",
    "methods": ["POST"]
  }' > /dev/null

# Create route for payment-api (/api/payments)
curl -s -X POST http://localhost:3000/kong/services/payment-api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/api/payments"],
    "name": "payments-route",
    "methods": ["GET", "POST", "PUT"]
  }' > /dev/null

# ============================================
# 3. TEST ROUTES WITH 10 CONCURRENT REQUESTS
# ============================================

for i in {1..10}; do 
  curl -s http://localhost:8000/api/users > /dev/null &
  curl -s http://localhost:8000/api/auth -X POST > /dev/null &
  curl -s http://localhost:8000/api/payments > /dev/null &
done
wait

sleep 2

# ============================================
# 4. DEBUG - CHECK RAW KONG METRICS
# ============================================
curl -s http://localhost:8001/metrics 2>/dev/null | awk '/http_requests_total/ && /source="service"/ {sum += $NF} END {print sum + 0}'

# ============================================
# 4.1. DISPLAY METRICS VIA ANALYTICS CONTROLLER
# ============================================
curl -s http://localhost:3000/api/analytics/metrics/current 2>/dev/null | jq .

# ============================================
# 5. SHOW SERVICES & ROUTES SUMMARY
# ============================================
curl -s http://localhost:3000/kong/services | jq '.data[] | {name: .name, url: .url}' 2>/dev/null

curl -s http://localhost:3000/kong/routes | jq '.data[] | {name: .name, paths: .paths, methods: .methods}' 2>/dev/null
