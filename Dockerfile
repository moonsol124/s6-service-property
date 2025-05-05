# Step 1: Use an official Node.js runtime as a parent image
# Using Alpine Linux for smaller image size
FROM node:18-alpine As base

# Step 2: Set the working directory in the container
WORKDIR /app

# Step 3: Copy package.json and package-lock.json (or yarn.lock)
# This leverages Docker layer caching. If these files don't change,
# subsequent builds won't need to reinstall dependencies.
COPY package*.json ./

# Step 4: Install production dependencies
# Using 'ci' for clean installs, respecting the lock file.
RUN npm ci --only=production

# Step 5: Copy the rest of the application code
COPY . .

# Step 6: Expose the port the app runs on
# Your app uses process.env.PORT || 3004. We expose the default.
# The actual port mapping happens in Kubernetes.
EXPOSE 3004

# Step 7: Define the command to run the application
CMD ["node", "server.js"]