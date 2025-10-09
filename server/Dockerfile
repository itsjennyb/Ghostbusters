FROM public.ecr.aws/lambda/nodejs:20 AS base

WORKDIR /var/task

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

CMD ["lambda.handler"]
