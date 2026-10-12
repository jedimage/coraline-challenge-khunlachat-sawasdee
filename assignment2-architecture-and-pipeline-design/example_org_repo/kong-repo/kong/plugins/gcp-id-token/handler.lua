local http = require "resty.http"

local GcpIdToken = {
  PRIORITY = 1000,
  VERSION  = "0.1.0",
}

local METADATA_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"

local function fetch_token(audience)
  local httpc = http.new()
  httpc:set_timeout(2000)

  local res, err = httpc:request_uri(METADATA_URL .. "?audience=" .. audience, {
    method  = "GET",
    headers = { ["Metadata-Flavor"] = "Google" },
  })

  if not res then
    return nil, "metadata request failed: " .. tostring(err)
  end

  if res.status ~= 200 then
    return nil, "metadata returned status " .. tostring(res.status) .. ": " .. tostring(res.body)
  end

  return res.body, nil, 3300
end

function GcpIdToken:access(conf)
  local cache_key = "gcp_id_token:" .. conf.audience
  local token, err = kong.cache:get(cache_key, nil, fetch_token, conf.audience)

  if not token then
    kong.log.err("gcp-id-token: ", err)
    return kong.response.exit(502, { message = "upstream auth token fetch failed" })
  end

  kong.service.request.set_header(conf.header_name or "X-Serverless-Authorization", "Bearer " .. token)
end

return GcpIdToken
