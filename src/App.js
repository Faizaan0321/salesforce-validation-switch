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
    if (!hash.includes("access_token")) return;

    const params = new URLSearchParams(hash.replace("#", "?"));
    const token = params.get("access_token");
    const url = decodeURIComponent(params.get("instance_url"));

    setAccessToken(token);
    setInstanceUrl(url);
    window.history.replaceState(null, null, "/");

    axios
      .get(`${url}/services/oauth2/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) =>
        setUserInfo({
          preferred_username: res.data.preferred_username,
          organization_name: res.data.organization_name,
        }),
      )
      .catch(() => setUserInfo(null));
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

    window.location.href = `${base}/services/oauth2/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  };

  const handleLogout = () => {
    setAccessToken(null);
    setInstanceUrl(null);
    setUserInfo(null);
    setRules([]);
    setMessage("");
  };

  const fetchRules = async () => {
    setLoading(true);
    setMessage("Fetching validation rules...");
    try {
      const query = `SELECT Id, ValidationName, Active FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = 'Account'`;

      const res = await axios.get(
        `${PROXY_BASE}/services/data/${API_VERSION}/tooling/query?q=${encodeURIComponent(query)}`,
        { headers: getHeaders() },
      );

      setRules(res.data.records.map((r) => ({ ...r, _pending: r.Active })));
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

  const enableAll = () =>
    setRules((prev) => prev.map((r) => ({ ...r, _pending: true })));

  const disableAll = () =>
    setRules((prev) => prev.map((r) => ({ ...r, _pending: false })));

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
        const metaRes = await axios.get(
          `${PROXY_BASE}/services/data/${API_VERSION}/tooling/sobjects/ValidationRule/${rule.Id}`,
          { headers: getHeaders() },
        );

        await axios.patch(
          `${PROXY_BASE}/services/data/${API_VERSION}/tooling/sobjects/ValidationRule/${rule.Id}`,
          {
            Metadata: {
              ...metaRes.data.Metadata,
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
      setMessage("Changes deployed successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || err.message);
    }

    setDeploying(false);
  };

  const hasPendingChanges = rules.some((r) => r._pending !== r.Active);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>Salesforce Toolkit</span>
      </div>

      <div style={styles.main}>
        <h1 style={styles.title}>Salesforce Switch</h1>

        {!accessToken ? (
          <div style={styles.card}>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              style={styles.select}
            >
              <option value="production">Production</option>
              <option value="sandbox">Sandbox</option>
            </select>

            <button onClick={handleLogin} style={styles.btnOrange}>
              LOGIN
            </button>
          </div>
        ) : (
          <>
            <div style={styles.card}>
              <p>Username: {userInfo?.preferred_username}</p>
              <p>Organisation: {userInfo?.organization_name}</p>

              <button onClick={handleLogout} style={styles.btnOrange}>
                LOGOUT
              </button>

              <button onClick={fetchRules} style={styles.btnOrange}>
                {loading ? "Loading..." : "GET METADATA"}
              </button>
            </div>

            {rules.length > 0 && (
              <div style={styles.card}>
                <button onClick={deployChanges} style={styles.btnBlue}>
                  {deploying ? "Deploying..." : "DEPLOY"}
                </button>

                {rules.map((rule) => (
                  <div key={rule.Id} style={styles.ruleRow}>
                    <span>{rule.ValidationName}</span>
                    <button onClick={() => toggleRule(rule.Id)}>
                      {rule._pending ? "ON" : "OFF"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {message && <p>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Arial", minHeight: "100vh", background: "#f4f6f9" },
  header: { background: "#fff", padding: "12px 24px" },
  logo: { fontSize: 18, fontWeight: "bold" },
  main: { maxWidth: 800, margin: "40px auto" },
  title: { color: "#e8a600" },
  card: { background: "#fff", padding: 20, marginBottom: 20 },
  select: { padding: 8, marginRight: 10 },
  btnOrange: { background: "#e8a600", color: "#fff", padding: 10 },
  btnBlue: { background: "#0070d2", color: "#fff", padding: 10 },
  ruleRow: { display: "flex", justifyContent: "space-between", marginTop: 10 },
};
