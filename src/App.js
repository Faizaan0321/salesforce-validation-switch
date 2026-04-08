import React, { useState, useEffect } from "react";
import axios from "axios";

const CLIENT_ID = "3MVG9WVXk15qiz1KyCZETiV7jKKaOiGv7UFSQpjxyZjKGBPunb3F6P9VtSfE0YnEm9SwCbAeozjyTb89ZYkd0";
const REDIRECT_URI = "http://localhost:3000/oauth/callback";
const PROXY_BASE = "http://localhost:3001/sfdc";
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
    setUserInfo({
      preferred_username: "Faizaan Khan",
      organization_id: "My Org",
    });

    window.history.replaceState(null, null, "/");
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
        { headers: getHeaders() }
      );
      setRules(res.data.records.map((r) => ({ ...r, _pending: r.Active })));
      setMessage("");
    } catch (err) {
      setMessage("Error fetching rules: " + (err.response?.data?.message || err.message));
    }
    setLoading(false);
  };

  const toggleRule = (id) => {
    setRules((prev) =>
      prev.map((r) => (r.Id === id ? { ...r, _pending: !r._pending } : r))
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
    setMessage(`Deploying ${changed.length} change(s)...`);

    try {
      for (const rule of changed) {
        await axios.patch(
          `${PROXY_BASE}/services/data/${API_VERSION}/tooling/sobjects/ValidationRule/${rule.Id}`,
          { Metadata: { active: rule._pending } },
          {
            headers: {
              ...getHeaders(),
              "Content-Type": "application/json",
            },
          }
        );
      }
      setRules((prev) => prev.map((r) => ({ ...r, Active: r._pending })));
      setMessage("✅ Changes deployed successfully!");
    } catch (err) {
      setMessage("❌ Deploy failed: " + (err.response?.data?.message || err.message));
    }
    setDeploying(false);
  };

  const hasPendingChanges = rules.some((r) => r._pending !== r.Active);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>⚙️ Salesforce Toolkit</span>
      </div>

      <div style={styles.main}>
        <h1 style={styles.title}>Salesforce Switch</h1>
        <p style={styles.subtitle}>
          Manage your Salesforce Validation Rules — enable, disable, and deploy changes directly.
        </p>

        {!accessToken ? (
          <div style={styles.card}>
            <label style={styles.label}>Environment</label>
            <div style={styles.row}>
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
          </div>
        ) : (
          <>
            <div style={styles.card}>
              <p><b>Logged in as:</b></p>
              <p>Username: {userInfo?.preferred_username}</p>
              <p>Organisation: {userInfo?.organization_id}</p>
              <div style={styles.row}>
                <button onClick={handleLogout} style={styles.btnOrange}>
                  LOGOUT
                </button>
                <button
                  onClick={fetchRules}
                  style={styles.btnOrange}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "GET METADATA"}
                </button>
              </div>
            </div>

            {rules.length > 0 && (
              <div style={styles.card}>
                <div style={styles.tabRow}>
                  <span style={styles.tab}>Validation Rules</span>
                </div>

                <div style={{ padding: "12px 0" }}>
                  <button
                    onClick={deployChanges}
                    style={{
                      ...styles.btnBlue,
                      opacity: hasPendingChanges ? 1 : 0.5,
                    }}
                    disabled={deploying || !hasPendingChanges}
                  >
                    {deploying ? "Deploying..." : `DEPLOY CHANGES${hasPendingChanges ? ` (${rules.filter(r => r._pending !== r.Active).length})` : ""}`}
                  </button>
                </div>

                <div style={styles.sectionHead}>
                  <b style={{ color: "#0070d2" }}>Account</b>
                  <div>
                    <button onClick={enableAll} style={styles.btnGreen}>
                      ENABLE ALL
                    </button>
                    <button
                      onClick={disableAll}
                      style={{ ...styles.btnRed, marginLeft: 8 }}
                    >
                      DISABLE ALL
                    </button>
                  </div>
                </div>

                {rules.map((rule) => (
                  <div key={rule.Id} style={styles.ruleRow}>
                    <div>
                      <span style={styles.ruleName}>{rule.ValidationName}</span>
                      {rule._pending !== rule.Active && (
                        <span style={styles.pendingBadge}>modified</span>
                      )}
                    </div>
                    <div
                      onClick={() => toggleRule(rule.Id)}
                      style={{
                        ...styles.toggle,
                        background: rule._pending ? "#e8a600" : "#ccc",
                      }}
                    >
                      <div
                        style={{
                          ...styles.ball,
                          left: rule._pending ? "34px" : "2px",
                        }}
                      />
                      <span
                        style={{
                          ...styles.toggleText,
                          left: rule._pending ? "6px" : "auto",
                          right: rule._pending ? "auto" : "6px",
                        }}
                      >
                        {rule._pending ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {message && <p style={styles.msg}>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Arial", minHeight: "100vh", background: "#f4f6f9" },
  header: {
    background: "#fff",
    padding: "12px 24px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
  },
  logo: { fontSize: 18, fontWeight: "bold" },
  main: { maxWidth: 800, margin: "40px auto", padding: "0 20px" },
  title: { color: "#e8a600", fontSize: 32 },
  subtitle: { color: "#555", marginBottom: 24 },
  card: {
    background: "#fff",
    padding: 24,
    borderRadius: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    marginBottom: 20,
  },
  label: { fontWeight: "bold" },
  row: { display: "flex", gap: 12, marginTop: 12, alignItems: "center" },
  select: {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 14,
  },
  btnOrange: {
    background: "#e8a600",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnBlue: {
    background: "#0070d2",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnGreen: {
    background: "#4caf50",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: "bold",
  },
  btnRed: {
    background: "#e53935",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: "bold",
  },
  tabRow: { borderBottom: "2px solid #e8a600", marginBottom: 12 },
  tab: {
    padding: "8px 16px",
    color: "#e8a600",
    fontWeight: "bold",
    borderBottom: "2px solid #e8a600",
    display: "inline-block",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "16px 0 8px",
  },
  ruleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  ruleName: { fontSize: 14, color: "#333" },
  pendingBadge: {
    marginLeft: 8,
    fontSize: 11,
    background: "#fff3cd",
    color: "#856404",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: "bold",
  },
  toggle: {
    position: "relative",
    width: 65,
    height: 28,
    borderRadius: 14,
    cursor: "pointer",
    transition: "background 0.3s",
  },
  ball: {
    position: "absolute",
    top: 3,
    width: 22,
    height: 22,
    background: "#fff",
    borderRadius: "50%",
    transition: "left 0.3s",
  },
  toggleText: {
    position: "absolute",
    top: 6,
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  msg: {
    padding: 12,
    background: "#fff",
    borderRadius: 8,
    textAlign: "center",
    fontWeight: "bold",
  },
};