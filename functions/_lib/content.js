export const FORUM_CATEGORIES = ["questions", "scripts", "tutorials", "math", "worldgen", "showcase"];
export const CODE_CATEGORIES = ["general", "pvp", "minigames", "worldgen", "admin", "math", "ui", "ai", "economy", "tutorials", "showcase", "bugs"];

// Returns { error } if invalid, or { title, category, content } if valid.
export function validateForumPost(body) {
  const title = (body.title || "").trim();
  const category = FORUM_CATEGORIES.includes(body.category) ? body.category : "questions";
  const content = (body.content || "").trim();

if (!title || !content) return { error: "Title and content are required." };
  if (title.length > 150) return { error: "Title must be 150 characters or fewer." };
  if (content.length > 5000) return { error: "Post content must be 5000 characters or fewer." };

return { title, category, content };
}

// Returns { error } if invalid, or { title, description, category, code } if valid.
export function validateCodeEntry(body) {
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const category = CODE_CATEGORIES.includes(body.category) ? body.category : "general";
  const code = body.code || "";

if (!title || !code) return { error: "Title and code are required." };
  if (title.length > 150) return { error: "Title must be 150 characters or fewer." };
  if (description.length > 1000) return { error: "Description must be 1000 characters or fewer." };
  if (code.length > 50000) return { error: "Code must be 50,000 characters or fewer." };

return { title, description, category, code };
}
