
import { useEffect, useMemo, useState } from "react";
import {
  createBattingRecord,
  deleteBattingRecord,
  getBattingRecords,
  updateBattingRecord,
} from "./api";
import "./App.css";

const initialForm = {
  playerName: "",
  teamName: "",
  matchName: "",
  runsScored: "",
  ballsFaced: "",
  fours: "",
  sixes: "",
  matchDate: "",
  isOut: "true",
};

const PAGE_SIZE = 8;

const number = (value) => Number(value ?? 0) || 0;
const runsOf = (record) => number(record.runsScored);
const ballsOf = (record) => number(record.ballsFaced);
const foursOf = (record) => number(record.fours);
const sixesOf = (record) => number(record.sixes);

function strikeRate(runs, balls) {
  return balls > 0 ? (runs * 100) / balls : 0;
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function recordDismissalLabel(value) {
  if (value === true) return "Out";
  if (value === false) return "Not out";
  return "Unknown";
}

function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search, filters, sorting and pagination.
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const [dismissalFilter, setDismissalFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [page, setPage] = useState(1);

  async function loadRecords() {
    setLoading(true);
    setError("");

    try {
      const data = await getBattingRecords();
      setRecords(data);

      setSelectedPlayer((current) => {
        const names = [
          ...new Set(
            data.map((record) => record.playerName?.trim()).filter(Boolean)
          ),
        ].sort((a, b) => a.localeCompare(b));

        if (current && names.includes(current)) return current;
        return names[0] ?? "";
      });
    } catch (err) {
      setError(
        `${err.message}. Check that the Spring Boot API is running on port 8080.`
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const playerNames = useMemo(
    () =>
      [
        ...new Set(
          records.map((record) => record.playerName?.trim()).filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const teamNames = useMemo(
    () =>
      [
        ...new Set(
          records.map((record) => record.teamName?.trim()).filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const matchNames = useMemo(
    () =>
      [
        ...new Set(
          records.map((record) => record.matchName?.trim()).filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const totals = useMemo(() => {
    const runs = records.reduce((sum, record) => sum + runsOf(record), 0);
    const balls = records.reduce((sum, record) => sum + ballsOf(record), 0);
    const fours = records.reduce((sum, record) => sum + foursOf(record), 0);
    const sixes = records.reduce((sum, record) => sum + sixesOf(record), 0);

    // Do not count records with unknown dismissal status in batting average.
    const knownStatusRecords = records.filter(
      (record) => record.isOut === true || record.isOut === false
    );
    const knownRuns = knownStatusRecords.reduce(
      (sum, record) => sum + runsOf(record),
      0
    );
    const dismissals = knownStatusRecords.filter(
      (record) => record.isOut === true
    ).length;

    const boundaryRuns = fours * 4 + sixes * 6;

    return {
      players: playerNames.length,
      innings: records.length,
      matches: new Set(
        records.map((record) => record.matchName?.trim()).filter(Boolean)
      ).size,
      runs,
      balls,
      fours,
      sixes,
      strikeRate: strikeRate(runs, balls),
      battingAverage: dismissals > 0 ? knownRuns / dismissals : null,
      boundaryPercentage:
        runs > 0 ? (boundaryRuns / runs) * 100 : 0,
      knownStatusInnings: knownStatusRecords.length,
    };
  }, [records, playerNames.length]);

  const playerProfiles = useMemo(() => {
    return playerNames
      .map((name) => {
        const playerRecords = records.filter(
          (record) => record.playerName?.trim() === name
        );

        const runs = playerRecords.reduce(
          (sum, record) => sum + runsOf(record),
          0
        );
        const balls = playerRecords.reduce(
          (sum, record) => sum + ballsOf(record),
          0
        );
        const fours = playerRecords.reduce(
          (sum, record) => sum + foursOf(record),
          0
        );
        const sixes = playerRecords.reduce(
          (sum, record) => sum + sixesOf(record),
          0
        );

        const known = playerRecords.filter(
          (record) => record.isOut === true || record.isOut === false
        );
        const knownRuns = known.reduce(
          (sum, record) => sum + runsOf(record),
          0
        );
        const dismissals = known.filter(
          (record) => record.isOut === true
        ).length;

        return {
          name,
          records: playerRecords,
          innings: playerRecords.length,
          runs,
          balls,
          fours,
          sixes,
          highestScore: Math.max(0, ...playerRecords.map(runsOf)),
          strikeRate: strikeRate(runs, balls),
          battingAverage:
            dismissals > 0 ? knownRuns / dismissals : null,
          matches: new Set(
            playerRecords
              .map((record) => record.matchName?.trim())
              .filter(Boolean)
          ).size,
        };
      })
      .sort((a, b) => b.runs - a.runs);
  }, [playerNames, records]);

  const selectedProfile = useMemo(
    () => playerProfiles.find((player) => player.name === selectedPlayer),
    [playerProfiles, selectedPlayer]
  );

  const topScorers = playerProfiles.slice(0, 5);

  const matchAnalytics = useMemo(() => {
    const grouped = new Map();

    records.forEach((record) => {
      const match = record.matchName?.trim() || "Unspecified match";
      const current = grouped.get(match) ?? {
        match,
        runs: 0,
        innings: 0,
        balls: 0,
      };

      current.runs += runsOf(record);
      current.innings += 1;
      current.balls += ballsOf(record);
      grouped.set(match, current);
    });

    return [...grouped.values()].sort((a, b) => b.runs - a.runs);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = records.filter((record) => {
      const searchable = [
        record.playerName,
        record.teamName,
        record.matchName,
        record.matchDate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesTeam =
        teamFilter === "all" || record.teamName?.trim() === teamFilter;
      const matchesMatch =
        matchFilter === "all" || record.matchName?.trim() === matchFilter;
      const matchesDismissal =
        dismissalFilter === "all" ||
        (dismissalFilter === "out" && record.isOut === true) ||
        (dismissalFilter === "not-out" && record.isOut === false) ||
        (dismissalFilter === "unknown" &&
          record.isOut !== true &&
          record.isOut !== false);

      return (
        matchesSearch &&
        matchesTeam &&
        matchesMatch &&
        matchesDismissal
      );
    });

    const compareText = (a, b, field) =>
      (a[field] ?? "").toString().localeCompare(
        (b[field] ?? "").toString(),
        undefined,
        { numeric: true, sensitivity: "base" }
      );

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "runs-desc":
          return runsOf(b) - runsOf(a);
        case "runs-asc":
          return runsOf(a) - runsOf(b);
        case "player-asc":
          return compareText(a, b, "playerName");
        case "player-desc":
          return compareText(b, a, "playerName");
        case "strike-desc":
          return (
            strikeRate(runsOf(b), ballsOf(b)) -
            strikeRate(runsOf(a), ballsOf(a))
          );
        case "date-asc":
          return compareText(a, b, "matchDate");
        case "date-desc":
        default:
          return compareText(b, a, "matchDate");
      }
    });

    return filtered;
  }, [
    records,
    search,
    teamFilter,
    matchFilter,
    dismissalFilter,
    sortBy,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const visibleRecords = filteredRecords.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, teamFilter, matchFilter, dismissalFilter, sortBy]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function handleEdit(record) {
    setEditingId(record.id);
    setForm({
      playerName: record.playerName ?? "",
      teamName: record.teamName ?? "",
      matchName: record.matchName ?? "",
      runsScored: record.runsScored ?? "",
      ballsFaced: record.ballsFaced ?? "",
      fours: record.fours ?? "",
      sixes: record.sixes ?? "",
      matchDate: record.matchDate ?? "",
      isOut:
        record.isOut === true
          ? "true"
          : record.isOut === false
            ? "false"
            : "",
    });

    setError("");
    setSuccess("");
    document
      .getElementById("record-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (form.isOut !== "true" && form.isOut !== "false") {
      setError("Please select Out or Not out before saving.");
      setSaving(false);
      return;
    }

    const payload = {
      playerName: form.playerName.trim(),
      teamName: form.teamName.trim(),
      matchName: form.matchName.trim(),
      runsScored: Number(form.runsScored),
      ballsFaced: Number(form.ballsFaced),
      fours: Number(form.fours),
      sixes: Number(form.sixes),
      matchDate: form.matchDate,
      isOut: form.isOut === "true",
    };

    try {
      if (editingId !== null) {
        await updateBattingRecord(editingId, payload);
        setSuccess("Batting record updated successfully.");
      } else {
        await createBattingRecord(payload);
        setSuccess("Batting record added successfully.");
      }

      resetForm();
      await loadRecords();
    } catch (err) {
      setError(err.message || "Unable to save the batting record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record) {
    const confirmed = window.confirm(
      `Delete the batting record for ${record.playerName || "this player"}?`
    );

    if (!confirmed) return;

    setDeletingId(record.id);
    setError("");
    setSuccess("");

    try {
      await deleteBattingRecord(record.id);
      if (editingId === record.id) resetForm();
      setSuccess("Batting record deleted successfully.");
      await loadRecords();
    } catch (err) {
      setError(err.message || "Unable to delete the batting record.");
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setTeamFilter("all");
    setMatchFilter("all");
    setDismissalFilter("all");
    setSortBy("date-desc");
    setPage(1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Local Cricket Stats home">
          <span className="brand-icon">🏏</span>
          <span>
            <strong>Local Cricket Stats</strong>
            <small>Batting performance dashboard</small>
          </span>
        </a>

        <nav className="top-nav">
          <a href="#analytics">Analytics</a>
          <a href="#player-profile">Player profile</a>
          <a href="#records">Records</a>
          <a href="#record-form" className="nav-action">+ Add record</a>
        </nav>
      </header>

      <main id="home" className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">YOUR CRICKET · YOUR NUMBERS</span>
            <h1>Every run tells a story.</h1>
            <p>
              Track innings, compare players, and understand batting
              performance with your own cricket statistics.
            </p>
            <a href="#analytics" className="primary-link">
              Explore analytics <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <span className="hero-ball">🏏</span>
            <span className="hero-number">100</span>
            <span className="hero-caption">ONE INNINGS AT A TIME</span>
          </div>
        </section>

        {error && (
          <div className="notice notice-error" role="alert">
            <span>{error}</span>
            <button type="button" className="notice-action" onClick={loadRecords}>
              Retry
            </button>
          </div>
        )}

        {success && (
          <div className="notice notice-success" role="status">
            <span>{success}</span>
            <button
              type="button"
              className="notice-close"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
            >
              ×
            </button>
          </div>
        )}

        <section className="section-block" aria-labelledby="overview-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">AT A GLANCE</span>
              <h2 id="overview-title">Your cricket overview</h2>
            </div>
            <span className="muted-text">
              {loading ? "Loading records…" : `${records.length} innings recorded`}
            </span>
          </div>

          <div className="stats-grid">
            <StatCard icon="👥" label="Players" value={totals.players} detail="Unique players" />
            <StatCard icon="🏆" label="Total runs" value={formatNumber(totals.runs, 0)} detail="Runs scored" />
            <StatCard icon="⚡" label="Overall strike rate" value={formatNumber(totals.strikeRate)} detail="Runs per 100 balls" />
            <StatCard icon="🎯" label="Innings" value={totals.innings} detail={`${totals.matches} named matches`} />
          </div>
        </section>

        <section id="analytics" className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PERFORMANCE INSIGHTS</span>
              <h2>Advanced cricket analytics</h2>
              <p className="section-description">
                A quick look at scoring, boundaries, and match-by-match runs.
              </p>
            </div>
          </div>

          <div className="analytics-grid">
            <article className="panel metric-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">SCORING</span>
                  <h3>Boundary percentage</h3>
                </div>
                <span className="panel-icon">💥</span>
              </div>
              <div className="metric-value">
                {formatNumber(totals.boundaryPercentage)}<span>%</span>
              </div>
              <p className="muted-text">
                {formatNumber(totals.fours * 4 + totals.sixes * 6, 0)} of{" "}
                {formatNumber(totals.runs, 0)} runs came from fours and sixes.
              </p>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Boundary percentage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, totals.boundaryPercentage)}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, totals.boundaryPercentage))}%`,
                  }}
                />
              </div>
              <div className="boundary-breakdown">
                <span>4s <strong>{totals.fours}</strong></span>
                <span>6s <strong>{totals.sixes}</strong></span>
              </div>
            </article>

            <article className="panel metric-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">DISMISSALS TRACKED</span>
                  <h3>Batting average</h3>
                </div>
                <span className="panel-icon">📈</span>
              </div>
              <div className="metric-value">
                {totals.battingAverage === null
                  ? "—"
                  : formatNumber(totals.battingAverage)}
              </div>
              <p className="muted-text">
                {totals.battingAverage === null
                  ? "Add known dismissal statuses to calculate the average."
                  : `Based on ${records.filter((r) => r.isOut === true || r.isOut === false).length} innings with known status.`}
              </p>
              <div className="average-note">
                <span className="status-dot" />
                Unknown dismissal statuses are excluded.
              </div>
            </article>
          </div>

          <div className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">MATCH BREAKDOWN</span>
                <h3>Runs per match</h3>
                <p className="muted-text">
                  Total runs aggregated from all recorded innings for each match name.
                </p>
              </div>
              <span className="panel-icon">📊</span>
            </div>

            {matchAnalytics.length === 0 ? (
              <EmptyState message="Add batting records to see runs per match." />
            ) : (
              <div className="bar-chart" aria-label="Runs per match bar chart">
                {matchAnalytics.slice(0, 8).map((match) => {
                  const maxRuns = Math.max(
                    1,
                    ...matchAnalytics.slice(0, 8).map((item) => item.runs)
                  );
                  const width = (match.runs / maxRuns) * 100;

                  return (
                    <div className="bar-row" key={match.match}>
                      <div className="bar-label" title={match.match}>
                        {match.match}
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${width}%` }}
                          title={`${match.runs} runs`}
                        />
                      </div>
                      <div className="bar-value">{formatNumber(match.runs, 0)}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {matchAnalytics.length > 8 && (
              <p className="chart-footnote">
                Showing the 8 highest-scoring match names out of {matchAnalytics.length}.
              </p>
            )}
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">LEADERBOARD</span>
                <h3>Top run scorers</h3>
              </div>
              <span className="muted-text">Ranked by total runs</span>
            </div>

            {topScorers.length === 0 ? (
              <EmptyState message="No player statistics yet. Add your first batting record." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Innings</th>
                      <th>Runs</th>
                      <th>Highest</th>
                      <th>Strike rate</th>
                      <th>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topScorers.map((player, index) => (
                      <tr key={player.name}>
                        <td><span className="rank-chip">{index + 1}</span></td>
                        <td><strong>{player.name}</strong></td>
                        <td>{player.innings}</td>
                        <td className="number-cell">{formatNumber(player.runs, 0)}</td>
                        <td>{player.highestScore}</td>
                        <td>{formatNumber(player.strikeRate)}</td>
                        <td>
                          {player.battingAverage === null
                            ? "—"
                            : formatNumber(player.battingAverage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section id="player-profile" className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PLAYER INSIGHTS</span>
              <h2>Player profile</h2>
              <p className="section-description">
                Review a player's scoring record and innings history.
              </p>
            </div>
            <div className="profile-select">
              <label htmlFor="profile-player">Select player</label>
              <select
                id="profile-player"
                value={selectedPlayer}
                onChange={(event) => setSelectedPlayer(event.target.value)}
                disabled={playerNames.length === 0}
              >
                {playerNames.length === 0 && <option value="">No players yet</option>}
                {playerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedProfile ? (
            <EmptyState message="Add a batting record to create a player profile." />
          ) : (
            <>
              <div className="profile-banner">
                <div className="profile-avatar">
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-title">
                  <h3>{selectedProfile.name}</h3>
                  <p>
                    {selectedProfile.innings} recorded innings ·{" "}
                    {selectedProfile.matches} named matches
                  </p>
                </div>
                <div className="profile-total">
                  <span>Total runs</span>
                  <strong>{formatNumber(selectedProfile.runs, 0)}</strong>
                </div>
              </div>

              <div className="profile-stats-grid">
                <ProfileStat label="Highest score" value={selectedProfile.highestScore} note="Best recorded innings" highlight />
                <ProfileStat label="Batting average" value={selectedProfile.battingAverage === null ? "—" : formatNumber(selectedProfile.battingAverage)} note="Known dismissal statuses" />
                <ProfileStat label="Strike rate" value={formatNumber(selectedProfile.strikeRate)} note="Runs per 100 balls" />
                <ProfileStat label="Fours" value={selectedProfile.fours} note={`${selectedProfile.fours * 4} boundary runs`} />
                <ProfileStat label="Sixes" value={selectedProfile.sixes} note={`${selectedProfile.sixes * 6} boundary runs`} />
                <ProfileStat label="Balls faced" value={formatNumber(selectedProfile.balls, 0)} note="Across recorded innings" />
              </div>

              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">PLAYER HISTORY</span>
                    <h3>Innings history</h3>
                  </div>
                  <span className="muted-text">{selectedProfile.innings} innings</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Match</th>
                        <th>Team</th>
                        <th>Runs</th>
                        <th>Balls</th>
                        <th>Strike rate</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedProfile.records]
                        .sort((a, b) => (b.matchDate ?? "").localeCompare(a.matchDate ?? ""))
                        .map((record) => (
                          <tr key={record.id}>
                            <td>{formatDate(record.matchDate)}</td>
                            <td>{record.matchName || "—"}</td>
                            <td>{record.teamName || "—"}</td>
                            <td className="number-cell">{runsOf(record)}</td>
                            <td>{ballsOf(record)}</td>
                            <td>{formatNumber(strikeRate(runsOf(record), ballsOf(record)))}</td>
                            <td>
                              <DismissalBadge value={record.isOut} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        <section id="record-form" className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RECORD MANAGEMENT</span>
              <h2>{editingId !== null ? "Edit batting record" : "Add a batting record"}</h2>
              <p className="section-description">
                Enter the scorecard details. Select the correct dismissal status.
              </p>
            </div>
          </div>

          <form className="panel record-form" onSubmit={handleSubmit}>
            <div className="form-section-title">
              <span className="form-step">01</span>
              <div>
                <h3>Player and match</h3>
                <p>Who played, and where?</p>
              </div>
            </div>

            <div className="form-grid">
              <FormField label="Player name" name="playerName" value={form.playerName} onChange={handleChange} placeholder="e.g. Rahul Sharma" required />
              <FormField label="Team name" name="teamName" value={form.teamName} onChange={handleChange} placeholder="e.g. City XI" required />
              <FormField label="Match name" name="matchName" value={form.matchName} onChange={handleChange} placeholder="e.g. Weekend Final" required />
              <FormField label="Match date" name="matchDate" type="date" value={form.matchDate} onChange={handleChange} required />
            </div>

            <div className="form-section-title">
              <span className="form-step">02</span>
              <div>
                <h3>Batting scorecard</h3>
                <p>Runs, balls, boundaries, and dismissal.</p>
              </div>
            </div>

            <div className="form-grid">
              <FormField label="Runs scored" name="runsScored" type="number" min="0" value={form.runsScored} onChange={handleChange} placeholder="0" required />
              <FormField label="Balls faced" name="ballsFaced" type="number" min="0" value={form.ballsFaced} onChange={handleChange} placeholder="0" required />
              <FormField label="Fours (4s)" name="fours" type="number" min="0" value={form.fours} onChange={handleChange} placeholder="0" required />
              <FormField label="Sixes (6s)" name="sixes" type="number" min="0" value={form.sixes} onChange={handleChange} placeholder="0" required />

              <div className="field">
                <label htmlFor="isOut">Dismissal status <span className="required-mark">*</span></label>
                <select
                  id="isOut"
                  name="isOut"
                  value={form.isOut}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose status</option>
                  <option value="true">Out</option>
                  <option value="false">Not out</option>
                </select>
                <small>Required for an accurate batting average.</small>
              </div>
            </div>

            {form.runsScored !== "" && form.ballsFaced !== "" && (
              <div className="live-preview">
                <span>Innings preview</span>
                <strong>{formatNumber(number(form.runsScored), 0)} runs</strong>
                <span>{formatNumber(strikeRate(number(form.runsScored), number(form.ballsFaced)))} strike rate</span>
                <span>{number(form.fours) * 4 + number(form.sixes) * 6} boundary runs</span>
              </div>
            )}

            <div className="form-actions">
              {editingId !== null && (
                <button type="button" className="button button-secondary" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "Saving…" : editingId !== null ? "Save changes" : "Add batting record"}
              </button>
            </div>
          </form>
        </section>

        <section id="records" className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ALL SCORECARDS</span>
              <h2>Batting records</h2>
              <p className="section-description">
                Search, filter, sort, edit, or remove individual innings.
              </p>
            </div>
            <span className="result-count">
              {filteredRecords.length} result{filteredRecords.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="panel records-panel">
            <div className="filters-grid">
              <div className="field search-field">
                <label htmlFor="record-search">Search</label>
                <input
                  id="record-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Player, team, match, or date…"
                />
              </div>

              <div className="field">
                <label htmlFor="team-filter">Team</label>
                <select id="team-filter" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                  <option value="all">All teams</option>
                  {teamNames.map((team) => <option key={team} value={team}>{team}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="match-filter">Match</label>
                <select id="match-filter" value={matchFilter} onChange={(event) => setMatchFilter(event.target.value)}>
                  <option value="all">All matches</option>
                  {matchNames.map((match) => <option key={match} value={match}>{match}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor="dismissal-filter">Dismissal</label>
                <select id="dismissal-filter" value={dismissalFilter} onChange={(event) => setDismissalFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="out">Out</option>
                  <option value="not-out">Not out</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="sort-records">Sort by</label>
                <select id="sort-records" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="date-desc">Newest date</option>
                  <option value="date-asc">Oldest date</option>
                  <option value="runs-desc">Most runs</option>
                  <option value="runs-asc">Fewest runs</option>
                  <option value="strike-desc">Highest strike rate</option>
                  <option value="player-asc">Player A–Z</option>
                  <option value="player-desc">Player Z–A</option>
                </select>
              </div>

              <div className="filter-actions">
                <button type="button" className="button button-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            </div>

            {loading ? (
              <EmptyState message="Loading batting records…" />
            ) : visibleRecords.length === 0 ? (
              <EmptyState message={records.length === 0 ? "No batting records yet. Add your first record above." : "No records match your search and filters."} />
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Team</th>
                        <th>Match</th>
                        <th>Date</th>
                        <th>Runs</th>
                        <th>Balls</th>
                        <th>4s</th>
                        <th>6s</th>
                        <th>Strike rate</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.map((record) => (
                        <tr key={record.id}>
                          <td><strong>{record.playerName || "—"}</strong></td>
                          <td>{record.teamName || "—"}</td>
                          <td>{record.matchName || "—"}</td>
                          <td>{formatDate(record.matchDate)}</td>
                          <td className="number-cell">{runsOf(record)}</td>
                          <td>{ballsOf(record)}</td>
                          <td>{foursOf(record)}</td>
                          <td>{sixesOf(record)}</td>
                          <td>{formatNumber(strikeRate(runsOf(record), ballsOf(record)))}</td>
                          <td><DismissalBadge value={record.isOut} /></td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="action-button edit-action" onClick={() => handleEdit(record)} aria-label={`Edit record for ${record.playerName}`}>
                                Edit
                              </button>
                              <button type="button" className="action-button delete-action" onClick={() => handleDelete(record)} disabled={deletingId === record.id} aria-label={`Delete record for ${record.playerName}`}>
                                {deletingId === record.id ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination">
                  <span>
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filteredRecords.length)} of{" "}
                    {filteredRecords.length}
                  </span>
                  <div className="pagination-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </button>
                    <span className="page-indicator">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="footer">
          <div className="footer-brand">🏏 Local Cricket Stats</div>
          <p>Built with React, Spring Boot, and MySQL.</p>
          <a href="#home">Back to top ↑</a>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, detail }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-detail">{detail}</span>
    </article>
  );
}

function ProfileStat({ label, value, note, highlight = false }) {
  return (
    <article className={`profile-stat ${highlight ? "profile-stat-highlight" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  min,
  required = false,
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        required={required}
      />
    </div>
  );
}

function DismissalBadge({ value }) {
  const className =
    value === true
      ? "dismissal-badge dismissal-out"
      : value === false
        ? "dismissal-badge dismissal-not-out"
        : "dismissal-badge dismissal-unknown";

  return <span className={className}>{recordDismissalLabel(value)}</span>;
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">🏏</span>
      <p>{message}</p>
    </div>
  );
}

export default App;
