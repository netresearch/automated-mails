FROM node:erbium-alpine

WORKDIR /app
EXPOSE 22003

COPY . /app
RUN chown node:node -R .
USER node

RUN yarn

CMD [ "node", "index.js" ]
