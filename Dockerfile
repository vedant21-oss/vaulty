# Production Dockerfile for Andhaar on Google Cloud Run
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy web application assets
COPY index.html app.html favicon.svg /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Cloud Run listens on port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
