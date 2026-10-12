return {
  name = "gcp-id-token",
  fields = {
    { config = {
        type = "record",
        fields = {
          { audience    = { type = "string", required = true } },
          { header_name = { type = "string", default  = "X-Serverless-Authorization" } },
        },
      },
    },
  },
}
