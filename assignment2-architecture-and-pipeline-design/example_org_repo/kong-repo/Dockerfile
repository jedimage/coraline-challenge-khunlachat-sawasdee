FROM kong:3.8

ARG KONG_CONFIG=kong/kong.dev.yml

ENV KONG_DATABASE=off \
    KONG_DECLARATIVE_CONFIG=/etc/kong/kong.yml \
    KONG_PROXY_ACCESS_LOG=/dev/stdout \
    KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    KONG_PROXY_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    KONG_PROXY_LISTEN=0.0.0.0:8000 \
    KONG_PLUGINS=bundled,gcp-id-token \
    KONG_TRUSTED_IPS=0.0.0.0/0,::/0 \
    KONG_REAL_IP_HEADER=X-Forwarded-For \
    KONG_REAL_IP_RECURSIVE=on

COPY ${KONG_CONFIG} /etc/kong/kong.yml

EXPOSE 8000
