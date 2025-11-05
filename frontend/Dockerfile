# Frontend multi-stage Dockerfile
# Build the Vite React app and serve via nginx

# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci --silent

# copy source and build
COPY frontend/ .
RUN npm run build

# Production stage - serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# optional: expose 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
