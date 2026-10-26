// Sitemap parsing and link building. Kept free of the vscode API so the tests
// in ../test can run it with plain Node.

import { parse } from "node-html-parser";

export const NAMESPACES = ["dental", "kfo", "allgemeinmedizin", "hno"];

export interface Link {
	label: string;
	detail: string;
}

export type Target =
	| { kind: "raw"; href: string } // external, javascript:, mailto:, …
	| { kind: "home" } // own domain, start page
	| { kind: "path"; path: string } // show.aspx, home.aspx, other files
	| { kind: "seo"; path: string; suffix: string }; // SEO URL, needs namespace

export interface Sitemap {
	entries: { label: string; target: Target }[];
	// SEO-URLs don't contain the namespace, so it has to be asked for
	usesSeoUrls: boolean;
}

export function readSitemap(html: string): Sitemap {
	const siteHosts = getSiteHosts(html);
	const entries = parse(html)
		.querySelectorAll(".sitemap-site a")
		.map((anchor) => ({
			label: anchor.text
				.replace(/\u00ad|&shy;/g, "")
				.replace(/\s+/g, " ")
				.trim(),
			target: classifyHref(anchor.attributes.href ?? "", siteHosts),
		}));
	return {
		entries,
		usesSeoUrls: entries.some((entry) => entry.target.kind === "seo"),
	};
}

// gwLinks are inserted after the /health/dental/gw_dental entry
export function buildLinks(
	sitemap: Sitemap,
	namespace: string | undefined,
	gwLinks: readonly { label: string; detail?: string }[],
): Link[] {
	if (sitemap.usesSeoUrls && NAMESPACES.indexOf(namespace) < 0) {
		throw new Error(`Sitemap with SEO-URLs needs a namespace: ${namespace}`);
	}

	const links: Link[] = [];
	for (const { label, target } of sitemap.entries) {
		const link = targetToLink(
			target,
			sitemap.usesSeoUrls ? namespace : undefined,
		);
		links.push({ label, detail: link });

		if (link.endsWith("/health/dental/gw_dental")) {
			for (const gwLink of gwLinks) {
				links.push({
					label: gwLink.label,
					detail: buildLink("scripts/show.aspx?content=" + gwLink.detail),
				});
			}
		}
	}
	return links;
}

// Hosts of the site itself, taken from its own /scripts/*.aspx URLs
export function getSiteHosts(html: string) {
	const hosts: string[] = [];
	const pattern = /https?:\/\/([^/"'\s]+)\/scripts\/\w+\.aspx/gi;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(html)) !== null) {
		hosts.push(match[1].toLowerCase());
	}
	return hosts;
}

export function classifyHref(href: string, siteHosts: string[]): Target {
	if (
		href === "" ||
		href.startsWith("#") ||
		/^(javascript|mailto|tel):/i.test(href)
	) {
		return { kind: "raw", href };
	}

	// Content links, also malformed ones like "https:/scripts/show.aspx?…"
	const content = /scripts\/show\.aspx\?.*$/i.exec(href);
	if (content !== null) {
		return { kind: "path", path: content[0] };
	}

	const absolute = /^[a-z][a-z\d+.-]*:\/\/([^/?#]+)(.*)$/i.exec(href);
	if (absolute !== null && siteHosts.indexOf(absolute[1].toLowerCase()) < 0) {
		return { kind: "raw", href }; // external site
	}

	const relative = absolute !== null ? absolute[2] : href;
	const [, rawPath, suffix] = /^([^?#]*)(.*)$/.exec(relative);
	const path = rawPath.replace(/^[./]+/, "").replace(/\/+$/, "");

	if (path === "" || /^home\.aspx$/i.test(path)) {
		return { kind: "home" };
	}

	// Files (home.aspx, scripts/kontakt/mail.aspx, …) are never SEO-URLs
	if (/\.[a-z\d]+$/i.test(path)) {
		return { kind: "path", path: path + suffix };
	}

	return { kind: "seo", path, suffix: suffix.replace(/^\?/, "&") };
}

// namespace is only set for sitemaps with SEO-URLs
export function targetToLink(target: Target, namespace: string | undefined) {
	switch (target.kind) {
		case "raw":
			return target.href;
		case "home":
			return namespace === undefined ? "http:/home.aspx" : "http:/";
		case "path":
			return buildLink(target.path);
		case "seo":
			return buildLink(
				`scripts/show.aspx?content=/health/${namespace}/${target.path}${target.suffix}`,
			);
	}
}

export function buildLink(path: string) {
	let link: string = path.startsWith("javascript") ? path : "http:/" + path;
	link = link.replace(/\/+/, "/");
	return link.replace(/\/\.\//, "/"); // Fix stuff for a certain someone
}
