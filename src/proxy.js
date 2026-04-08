const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

const app = express();
app.use(cors());

app.use("/sfdc", (req, res, next) => {
  const instanceUrl = req.headers["x-instance-url"];

  if (!instanceUrl) {
    return res.status(400).send("Missing instance URL");
  }

  const proxy = createProxyMiddleware({
    target: instanceUrl,
    changeOrigin: true,
    pathRewrite: { "^/sfdc": "" },
    headers: {
      Authorization: req.headers["authorization"], // 🔥 important
    },
  });

  proxy(req, res, next);
});

app.listen(3001, () => {
  console.log("Proxy server running on port 3001");
});