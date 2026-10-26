import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
	buildLinks,
	classifyHref,
	NAMESPACES,
	readSitemap,
	type Link,
} from "../src/sitemap.ts";

// Tests run from the repository root (see `test` in scripts/build.mjs)
const fixture = (name: string) =>
	readFileSync(join("packages", "linq", "test", "fixtures", name), "utf8");

const SHOW = "http:/scripts/show.aspx?content=";

const gwLinks = [
	{ label: "Keramik", detail: "/health/dental/gw_dental/aesthetik/keramik" },
	{
		label: "Bleaching",
		detail: "/health/dental/gw_dental/aesthetik/bleaching",
	},
];

const find = (links: Link[], label: string) => {
	const found = links.filter((link) => link.label === label);
	assert.ok(found.length > 0, `no link labelled "${label}"`);
	return found.map((link) => link.detail);
};

describe("sitemap without SEO-URLs", () => {
	const sitemap = readSitemap(fixture("sitemap-no-seourls.html"));
	const links = buildLinks(sitemap, undefined, gwLinks);

	it("does not need a namespace", () => {
		assert.equal(sitemap.usesSeoUrls, false);
	});

	it("only reads links inside .sitemap-site", () => {
		assert.equal(links.length, 9);
		assert.ok(!links.some((link) => link.label === "Termin buchen"));
		assert.ok(!links.some((link) => link.label === "Sitemap"));
	});

	it("links home to http:/home.aspx", () => {
		assert.deepEqual(find(links, "Home"), ["http:/home.aspx"]);
	});

	it("keeps content paths", () => {
		assert.deepEqual(find(links, "Sofort feste Zähne"), [
			`${SHOW}/health/dental/sofort-feste-zaehne`,
		]);
		assert.deepEqual(find(links, "Keramik vs. Titan"), [
			`${SHOW}/health/dental/keramikimplantate/keramik-vs-titan`,
		]);
	});

	it("removes soft hyphens from labels", () => {
		assert.deepEqual(find(links, "Datenschutzerklärung"), [
			`${SHOW}/health/dental/kontakt/datenschutzerklaerung`,
		]);
	});

	it("builds every link with http:/scripts/show.aspx?content=/health/dental/", () => {
		for (const link of links.filter((l) => l.label !== "Home")) {
			assert.ok(link.detail.startsWith(`${SHOW}/health/dental/`), link.detail);
		}
	});
});

describe("sitemap with SEO-URLs", () => {
	const sitemap = readSitemap(fixture("sitemap-seourls.html"));

	it("needs a namespace", () => {
		assert.equal(sitemap.usesSeoUrls, true);
		assert.throws(() => buildLinks(sitemap, undefined, gwLinks));
		assert.throws(() => buildLinks(sitemap, "zahnmedizin", gwLinks));
	});

	for (const namespace of NAMESPACES) {
		describe(`with namespace ${namespace}`, () => {
			const links = buildLinks(sitemap, namespace, gwLinks);

			it("links the own domain to http:/", () => {
				assert.deepEqual(find(links, "Home"), ["http:/"]);
			});

			it("prefixes SEO paths with /health/<namespace>", () => {
				assert.deepEqual(find(links, "Praxis"), [
					`${SHOW}/health/${namespace}/praxis`,
				]);
				assert.deepEqual(find(links, "Weisheitszähne"), [
					`${SHOW}/health/${namespace}/leistungen/oralchirurgie/weisheitszaehne`,
				]);
			});
		});
	}

	const links = buildLinks(sitemap, "dental", gwLinks);

	it("only reads links inside .sitemap-site", () => {
		assert.equal(links.length, 18);
		assert.ok(!links.some((link) => link.label === "Termin buchen"));
		assert.ok(!links.some((link) => link.label === "Sitemap"));
	});

	it("keeps content links that are already in the sitemap", () => {
		// 2× "/infozentrum/vorher-nachher-galerie" and once written as
		// "https:/scripts/show.aspx?content=/health/dental/infozentrum/…"
		assert.deepEqual(
			find(links, "Vorher-Nachher-Galerie"),
			Array(3).fill(`${SHOW}/health/dental/infozentrum/vorher-nachher-galerie`),
		);
		assert.deepEqual(find(links, "Vita Dr. Muster"), [
			`${SHOW}/health/dental/team#team`,
		]);
	});

	it("leaves external links alone", () => {
		assert.deepEqual(find(links, "Example TV"), [
			"https://www.youtube.com/@example",
		]);
	});

	it("removes soft hyphens and markup from labels", () => {
		assert.deepEqual(find(links, "Veneers / Frontzahnästhetik"), [
			`${SHOW}/health/dental/leistungen/aesthetische-zahnmedizin/veneers-frontzahnaesthetik`,
		]);
		assert.deepEqual(find(links, "Wurzelspitzenresektion"), [
			`${SHOW}/health/dental/leistungen/oralchirurgie/wurzelspitzenresektion`,
		]);
	});

	it("builds every internal link with http:/scripts/show.aspx", () => {
		for (const { label, detail } of links) {
			if (label === "Home" || label === "Example TV") {
				continue;
			}
			assert.ok(detail.startsWith(`${SHOW}/health/dental/`), detail);
		}
	});
});

describe("gw_dental", () => {
	const html = (href: string) =>
		`<div class="sitemap-site"><a href="${href}">Gesundheitswissen</a></div>`;

	it("inserts the gw_dental links after the gw_dental entry", () => {
		for (const [href, namespace] of [
			["/scripts/show.aspx?content=/health/dental/gw_dental", undefined],
			["/gw_dental", "dental"],
		]) {
			assert.deepEqual(
				buildLinks(readSitemap(html(href)), namespace, gwLinks),
				[
					{
						label: "Gesundheitswissen",
						detail: `${SHOW}/health/dental/gw_dental`,
					},
					{
						label: "Keramik",
						detail: `${SHOW}/health/dental/gw_dental/aesthetik/keramik`,
					},
					{
						label: "Bleaching",
						detail: `${SHOW}/health/dental/gw_dental/aesthetik/bleaching`,
					},
				],
			);
		}
	});
});

describe("classifyHref", () => {
	const hosts = ["www.example.de"];

	it("keeps javascript:, mailto:, tel: and anchors", () => {
		for (const href of [
			"javascript:toggleDrFlexAppointments()",
			"mailto:info@example.de",
			"tel:0341-2219127",
			"#main-content",
		]) {
			assert.deepEqual(classifyHref(href, hosts), { kind: "raw", href });
		}
	});

	it("recognises the own domain", () => {
		for (const href of [
			"/",
			"/home.aspx",
			"https://www.example.de",
			"https://WWW.EXAMPLE.DE/",
		]) {
			assert.deepEqual(classifyHref(href, hosts), { kind: "home" }, href);
		}
		assert.deepEqual(classifyHref("https://www.example.de/team", hosts), {
			kind: "seo",
			path: "team",
			suffix: "",
		});
	});

	it("never treats files as SEO-URLs", () => {
		assert.deepEqual(classifyHref("/scripts/kontakt/mail.aspx", hosts), {
			kind: "path",
			path: "scripts/kontakt/mail.aspx",
		});
	});

	it("keeps query strings and fragments of SEO-URLs", () => {
		assert.deepEqual(classifyHref("/team/?x=1#vita", hosts), {
			kind: "seo",
			path: "team",
			suffix: "&x=1#vita",
		});
	});
});
