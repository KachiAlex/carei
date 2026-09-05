#!/bin/bash
for p in 3011 3012 3013 3014 3016 3017 3018 3019 3020 3021 3022 3023 3024 3025; do
  if ss -tlnp sport = :$p 2>/dev/null | grep -q LISTEN; then
    echo "$p BUSY"
  else
    echo "$p FREE"
  fi
done
