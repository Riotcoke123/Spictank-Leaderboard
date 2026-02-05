// Helper: show medal for top ranks
function getRankDisplay(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
}

// Load leaderboard from API
async function loadLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        const tbody = document.getElementById("leaderboard");
        tbody.innerHTML = "";

        let sumPosts = 0;
        let sumScore = 0;

        data.forEach((u, i) => {
            sumPosts += (u.post_count || 0);
            sumScore += (u.calculated_score || 0);

            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td class="col-rank"><div class="rank-inner">${getRankDisplay(i + 1)}</div></td>
                    <td class="col-username">
                        <div class="username-inner">
                            <a href="https://communities.win/u/${u.author}" target="_blank">${u.author}</a>
                        </div>
                    </td>
                    <td class="col-posts">${u.post_count || 0}</td>
                    <td class="col-active last-active" title="${new Date(u.last_active).toLocaleString()}">
                        ${u.last_active_ago || "Unknown"}
                    </td>
                    <td class="col-score"><span class="score-value">${u.calculated_score.toLocaleString()}</span></td>
                </tr>
            `);
        });

        // Update stats
        document.getElementById("totalUsers").textContent = data.length;
        document.getElementById("totalPosts").textContent = sumPosts.toLocaleString();
        document.getElementById("totalScore").textContent = sumScore.toLocaleString();
        document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString();
    } catch (err) {
        console.error("Failed to load leaderboard:", err);
        const tbody = document.getElementById("leaderboard");
        tbody.innerHTML = `<tr><td colspan="5" class="loading">Failed to load leaderboard.</td></tr>`;
    }
}

// Initial load
loadLeaderboard();
// Refresh every minute
setInterval(loadLeaderboard, 60000);
