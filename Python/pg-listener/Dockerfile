FROM python:3.7.7-alpine as base

FROM base as builder

WORKDIR /install
RUN apk update && apk add postgresql-dev gcc python3-dev musl-dev
RUN pip3 install --install-option="--prefix=/install" psycopg2 kafka-python requests pgpubsub


FROM base

COPY --from=builder /install /usr/local
RUN apk --no-cache add libpq

WORKDIR /app

COPY . .

CMD ["python3","main.py"]