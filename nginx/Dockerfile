FROM nginx:1.19.0-alpine

RUN rm /etc/nginx/conf.d/default.conf
RUN mkdir /app
COPY ./local.conf /etc/nginx/conf.d/
WORKDIR /app
