FROM golang:1-alpine AS build

WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /server .

FROM alpine:3

RUN adduser -D -u 10001 app
COPY --from=build /server /usr/local/bin/server
USER app

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/server"]
