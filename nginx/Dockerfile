FROM nginx:1.25

RUN rm /etc/nginx/conf.d/default.conf
RUN mkdir /app
COPY ./local.conf /etc/nginx/conf.d/
WORKDIR /app
