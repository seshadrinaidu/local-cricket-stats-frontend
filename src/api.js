
const API_URL = "http://localhost:8080/api/batting-records";

async function readResponse(response) {
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      body || `Request failed with HTTP status ${response.status}`
    );
  }

  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function getBattingRecords() {
  const response = await fetch(API_URL);
  const data = await readResponse(response);

  if (!Array.isArray(data)) {
    throw new Error("The API did not return a list of batting records.");
  }

  return data;
}

export async function createBattingRecord(record) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  return readResponse(response);
}

export async function updateBattingRecord(id, record) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  return readResponse(response);
}

export async function deleteBattingRecord(id) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  return readResponse(response);
}
