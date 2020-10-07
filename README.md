# Automated Mails

Automatically sends premade emails depending on a cron schedule.

## Running it

```sh
docker run --env-file .env -v $PWD/mails:/app/mails -it netresearch/automated-mails
```
