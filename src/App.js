import React, { useState, useEffect } from "react";
import axios from "axios";

const CLIENT_ID =
  "3MVG9WVXk15qiz1KyCZETiV7jKKaOiGv7UFSQpjxyZjKGBPunb3F6P9VtSfE0YnEm9SwCbAeozjyTb89ZYkd0";

const REDIRECT_URI = "https://salesforce-validation-switch.vercel.app/";

const PROXY_BASE = "https://salesforce-validation-switch.onrender.com/sfdc";
const API_VERSION = "v59.0";

export default function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [instanceUrl, setInstanceUrl] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState("");
  const [environment, setEnvironment] = useState("production");

  useEffect(() => {
    const hash = window.location.hash;

    if (!hash || !hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.replace("#", "?"));
    const token = params.get("access_token");
    const url = decodeURIComponent(params.get("instance_url"));

    if (!token || !url) return;

    setAccessToken(token);
    setInstanceUrl(url);

    axios
      .get(`${url}/services/oauth2/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUserInfo(res.data))
      .catch(() => setUserInfo(null));

    window.history.replaceState({}, document.title, "/");
  }, []);

  const getHeaders = () => ({
    Authorization: `Bearer ${accessToken}`,
    "x-instance-url": instanceUrl,
  });

  const handleLogin = () => {
    const base =
      environment === "sandbox"
        ? "https://test.salesforce.com"
        : "https://login.salesforce.com";

    window.location.href = `${base}/services/oauth2/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI,
    )}`;
  };

  const handleLogout = () => {
    setAccessToken(null);
    setInstanceUrl(null);
    setUserInfo(null);
    setRules([]);
    setMessage("");
  };

  const fetchRules = async () => {
    if (!accessToken || !instanceUrl) return;

    setLoading(true);
    setMessage("Fetching validation rules...");

    try {
      const query = `SELECT Id, ValidationName, Active FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = 'Account'`;

      const res = await axios.get(
        `${PROXY_BASE}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(
          query,
        )}`,
        { headers: getHeaders() },
      );

      setRules(
        res.data.records.map((r) => ({
          ...r,
          _pending: r.Active,
        })),
      );

      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }

    setLoading(false);
  };

  const toggleRule = (id) => {
    setRules((prev) =>
      prev.map((r) => (r.Id === id ? { ...r, _pending: !r._pending } : r)),
    );
  };

  const deployChanges = async () => {
    const changed = rules.filter((r) => r._pending !== r.Active);

    if (changed.length === 0) {
      setMessage("No changes to deploy.");
      return;
    }

    setDeploying(true);
    setMessage("Deploying...");

    try {
      for (const rule of changed) {
        await axios.patch(
          `${PROXY_BASE}/services/data/${API_VERSION}/tooling/sobjects/ValidationRule/${rule.Id}`,
          {
            Metadata: {
              fullName: rule.ValidationName,
              active: rule._pending,
            },
          },
          {
            headers: {
              ...getHeaders(),
              "Content-Type": "application/json",
            },
          },
        );
      }

      setRules((prev) => prev.map((r) => ({ ...r, Active: r._pending })));

      setMessage("✅ Deployed successfully");
    } catch (err) {
      setMessage(
        "❌ Deploy failed: " + (err.response?.data?.message || err.message),
      );
    }

    setDeploying(false);
  };

  return (
    <div style={{ padding: 40 }}>
      {!accessToken ? (
        <>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>

          <button onClick={handleLogin}>LOGIN</button>
        </>
      ) : (
        <>
          <h3>Username: {userInfo?.preferred_username}</h3>
          <h3>Organisation: {userInfo?.organization_name}</h3>

          <button onClick={handleLogout}>LOGOUT</button>
          <button onClick={fetchRules}>
            {loading ? "Loading..." : "GET METADATA"}
          </button>

          <button onClick={deployChanges}>
            {deploying ? "Deploying..." : "DEPLOY"}
          </button>

          {rules?.map((r) => (
            <div key={r.Id}>
              {r.ValidationName}
              <button onClick={() => toggleRule(r.Id)}>
                {r._pending ? "ON" : "OFF"}
              </button>
            </div>
          ))}

          <p>{message}</p>
        </>
      )}
    </div>
  );
}
