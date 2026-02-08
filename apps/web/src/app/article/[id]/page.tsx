"use client";

import { useParams, redirect } from "next/navigation";

/**
 * Legacy route — redirects to /news/[id].
 * Kept so bookmarks and old links still work.
 */
export default function ArticleRedirect() {
  const params = useParams();
  redirect(`/news/${params.id}`);
}

