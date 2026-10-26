// Finding the sitemap of a site from any of its URLs. Kept free of the vscode
// API so the tests in ../test can run it with plain Node.

import { NAMESPACES, readSitemap, type Sitemap } from "./sitemap.ts";

export interface Candidate {
	url: string;
	namespace?: string; // known from a /health/<namespace>/ URL
}

export interface Found extends Candidate {
	sitemap: Sitemap;
}

export interface Attempt {
	url: string;
	error: string;
}

// Throw for HTTP error statuses; any other error means the site is unreachable
export type FetchHtml = (url: string) => Promise<string>;

export class HttpError extends Error {
	readonly status: number;

	constructor(status: number) {
		super(`HTTP ${status}`);
		this.status = status;
	}
}

// "example.de" or "www.example.de/praxis" default to https://
export function normalizeUrl(input: string): URL | undefined {
	let text = input.trim();
	if (text === "") {
		return undefined;
	}
	if (!/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
		text = "https://" + text;
	}
	try {
		const url = new URL(text);
		return /^https?:$/.test(url.protocol) && url.hostname !== ""
			? url
			: undefined;
	} catch {
		return undefined;
	}
}

// The given URL, then /sitemap, then the sitemap of every namespace, starting
// with the one in the given URL
export function sitemapCandidates(url: URL): Candidate[] {
	const namespace = namespaceOf(url);
	const namespaces = [
		...(namespace === undefined ? [] : [namespace]),
		...NAMESPACES.filter((ns) => ns !== namespace),
	];
	const candidates: Candidate[] = [
		{ url: url.href, namespace },
		{ url: `${url.origin}/sitemap` },
		...namespaces.map((ns) => ({
			url: `${url.origin}/scripts/show.aspx?content=/health/${ns}/sitemap`,
			namespace: ns,
		})),
	];
	return candidates.filter(
		(candidate, i) =>
			candidates.findIndex((other) => other.url === candidate.url) === i,
	);
}

export function namespaceOf(url: URL): string | undefined {
	let text = url.pathname + url.search;
	try {
		text = decodeURIComponent(text);
	} catch {
		// keep it encoded
	}
	const match = /\/health\/([^/?#&]+)/i.exec(text);
	const namespace = match === null ? undefined : match[1].toLowerCase();
	return NAMESPACES.indexOf(namespace) < 0 ? undefined : namespace;
}

// First candidate whose page has sitemap entries. Stops at the first
// unreachable URL, since all candidates are on the same host.
export async function findSitemap(
	url: URL,
	fetchHtml: FetchHtml = fetchText,
): Promise<{ found?: Found; attempts: Attempt[] }> {
	const attempts: Attempt[] = [];
	for (const candidate of sitemapCandidates(url)) {
		let html: string;
		try {
			html = await fetchHtml(candidate.url);
		} catch (error) {
			const message = errorMessage(error);
			if (error instanceof HttpError) {
				attempts.push({ url: candidate.url, error: message });
				continue;
			}
			attempts.push({
				url: candidate.url,
				error: `nicht erreichbar (${message})`,
			});
			break;
		}

		const sitemap = readSitemap(html);
		if (sitemap.entries.length > 0) {
			return { found: { ...candidate, sitemap }, attempts };
		}
		attempts.push({ url: candidate.url, error: "keine Sitemap" });
	}
	return { attempts };
}

// fetch() only says "fetch failed"; the reason (ENOTFOUND, …) is its cause
function errorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}
	return error.cause instanceof Error
		? `${error.message}: ${error.cause.message}`
		: error.message;
}

export async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		redirect: "follow",
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		throw new HttpError(response.status);
	}

	// Older sites may not be UTF-8
	const bytes = await response.arrayBuffer();
	const charset = /charset=["']?([^;"'\s]+)/i.exec(
		response.headers.get("content-type") ?? "",
	);
	try {
		return new TextDecoder(charset === null ? "utf-8" : charset[1]).decode(
			bytes,
		);
	} catch {
		return new TextDecoder().decode(bytes); // unknown charset
	}
}
