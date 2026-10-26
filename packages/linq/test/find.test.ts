import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	findSitemap,
	HttpError,
	namespaceOf,
	normalizeUrl,
	sitemapCandidates,
	type FetchHtml,
} from "../src/find.ts";

// Tests run from the repository root (see `test` in scripts/build.mjs)
const fixture = (name: string) =>
	readFileSync(join("packages", "linq", "test", "fixtures", name), "utf8");

const SITEMAP = fixture("sitemap-no-seourls.html");
const NOT_A_SITEMAP = "<html><body><a href='/praxis'>Praxis</a></body></html>";
const show = (ns: string) =>
	`https://www.example.de/scripts/show.aspx?content=/health/${ns}/sitemap`;

// Pages by URL; anything else is a 404
const site = (pages: Record<string, string>) => {
	const requested: string[] = [];
	const fetchHtml: FetchHtml = async (url) => {
		requested.push(url);
		if (url in pages) {
			return pages[url];
		}
		throw new HttpError(404);
	};
	return { fetchHtml, requested };
};

const url = (input: string) => {
	const parsed = normalizeUrl(input);
	assert.ok(parsed !== undefined, input);
	return parsed;
};

describe("normalizeUrl", () => {
	it("defaults to https", () => {
		assert.equal(url("example.de").href, "https://example.de/");
		assert.equal(
			url(" www.example.de/praxis ").href,
			"https://www.example.de/praxis",
		);
	});

	it("keeps http and https URLs", () => {
		assert.equal(
			url("http://www.example.de/sitemap").href,
			"http://www.example.de/sitemap",
		);
	});

	it("rejects empty input and other protocols", () => {
		assert.equal(normalizeUrl(""), undefined);
		assert.equal(normalizeUrl("ftp://example.de"), undefined);
		assert.equal(normalizeUrl("https://"), undefined);
	});
});

describe("namespaceOf", () => {
	it("reads the namespace from content URLs", () => {
		assert.equal(namespaceOf(url(show("kfo"))), "kfo");
		assert.equal(
			namespaceOf(
				url(
					"www.example.de/scripts/show.aspx?content=%2Fhealth%2FHNO%2Fpraxis",
				),
			),
			"hno",
		);
	});

	it("ignores unknown namespaces and other URLs", () => {
		assert.equal(namespaceOf(url(show("zahnmedizin"))), undefined);
		assert.equal(namespaceOf(url("www.example.de/praxis")), undefined);
	});
});

describe("sitemapCandidates", () => {
	it("tries the URL, /sitemap, then every namespace", () => {
		assert.deepEqual(
			sitemapCandidates(url("www.example.de/praxis")).map((c) => c.url),
			[
				"https://www.example.de/praxis",
				"https://www.example.de/sitemap",
				show("dental"),
				show("kfo"),
				show("allgemeinmedizin"),
				show("hno"),
			],
		);
	});

	it("tries the namespace of the URL first and doesn't repeat URLs", () => {
		assert.deepEqual(sitemapCandidates(url(show("hno"))), [
			{ url: show("hno"), namespace: "hno" },
			{ url: "https://www.example.de/sitemap" },
			{ url: show("dental"), namespace: "dental" },
			{ url: show("kfo"), namespace: "kfo" },
			{ url: show("allgemeinmedizin"), namespace: "allgemeinmedizin" },
		]);
	});
});

describe("findSitemap", () => {
	it("uses the given URL if it is the sitemap", async () => {
		const { fetchHtml, requested } = site({
			"https://www.example.de/sitemap": SITEMAP,
		});
		const { found } = await findSitemap(
			url("www.example.de/sitemap"),
			fetchHtml,
		);
		assert.equal(found.url, "https://www.example.de/sitemap");
		assert.equal(found.namespace, undefined);
		assert.ok(found.sitemap.entries.length > 0);
		assert.deepEqual(requested, ["https://www.example.de/sitemap"]);
	});

	it("finds /sitemap from any page of the site", async () => {
		const { fetchHtml } = site({
			"https://www.example.de/praxis": NOT_A_SITEMAP,
			"https://www.example.de/sitemap": SITEMAP,
		});
		const { found, attempts } = await findSitemap(
			url("www.example.de/praxis"),
			fetchHtml,
		);
		assert.equal(found.url, "https://www.example.de/sitemap");
		assert.deepEqual(attempts, [
			{ url: "https://www.example.de/praxis", error: "keine Sitemap" },
		]);
	});

	it("finds a namespace sitemap and keeps its namespace", async () => {
		const { fetchHtml } = site({ [show("allgemeinmedizin")]: SITEMAP });
		const { found, attempts } = await findSitemap(
			url("www.example.de"),
			fetchHtml,
		);
		assert.equal(found.url, show("allgemeinmedizin"));
		assert.equal(found.namespace, "allgemeinmedizin");
		assert.deepEqual(
			attempts.map((a) => a.error),
			["HTTP 404", "HTTP 404", "HTTP 404", "HTTP 404"],
		);
	});

	it("reports every attempt if there is no sitemap", async () => {
		const { fetchHtml } = site({});
		const { found, attempts } = await findSitemap(
			url("www.example.de"),
			fetchHtml,
		);
		assert.equal(found, undefined);
		assert.equal(attempts.length, 6);
	});

	it("stops when the site is unreachable", async () => {
		const requested: string[] = [];
		const { found, attempts } = await findSitemap(
			url("www.example.invalid"),
			async (u) => {
				requested.push(u);
				throw new Error("getaddrinfo ENOTFOUND");
			},
		);
		assert.equal(found, undefined);
		assert.equal(requested.length, 1);
		assert.match(attempts[0].error, /nicht erreichbar.*ENOTFOUND/);
	});
});
