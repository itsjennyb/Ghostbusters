FROM public.ecr.aws/lambda/nodejs:20 AS base

# Set working directory
WORKDIR /var/task

# Copy only package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# 🔍 Debug: Check if aws-sdk is there
RUN ls node_modules/aws-sdk || (echo "❌ aws-sdk not found!" && exit 1)

# Copy all source files AFTER dependencies are installed
COPY . .

ENV NODE_ENV=production

CMD ["lambda.handler"]