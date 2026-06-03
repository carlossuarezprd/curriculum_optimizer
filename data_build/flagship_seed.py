"""Default flagship seed: (course name pattern, professor last name | ANY, label).

A flagship is the subset of a course's sections taught by a particular
professor. The list is user-configurable in the app; this is only the default
suggestion, seeded from CLAUDE.md. Each entry is resolved to a course_number by
matching the catalog course names at build time; unresolved entries are flagged.
"""

FLAGSHIP_SEED = [
    (r"cases in financial management", "BORN", "Cases in Financial Management — Born"),
    (r"entrepreneurial finance and private equity", "KAPLAN",
     "Entrepreneurial Finance and Private Equity — Kaplan"),
    (r"merger.*acquisition strateg", "MORRISSETTE", "Merger & Acquisition Strategy — Morrissette"),
    (r"pricing strateg", "DUB", "Pricing Strategies — Dubé"),
    (r"designing a good life", "EPLEY", "Designing a Good Life — Epley"),
    (r"commercializing innovation", "MEADOW", "Commercializing Innovation — Meadow"),
    (r"study of behavioral economics", "POPE",
     "The Study of Behavioral Economics — Pope"),
    (r"^money and banking", "KROSZNER", "Money and Banking — Kroszner"),
    (r"business,? politics,? and ethics", "BERTRAND",
     "Business, Politics & Ethics — Bertrand"),
    (r"firm and the non-market environment", "BERTRAND",
     "Firm and Non-Market Environment — Bertrand"),
    (r"^portfolio management", "PASTOR", "Portfolio Management — Pástor"),
    (r"valuation of firms in global", "LEUZ",
     "Advanced Financial Analysis and Valuation for Global Firms — Leuz"),
    (r"strategies and processes of negotiation", "ANY",
     "Negotiations — any professor"),
    (r"private equity/venture capital lab|pe/vc lab", "ANY", "PE/VC Lab"),
    (r"interpersonal dynamics", "ANY", "Interpersonal Dynamics"),
]

# Known application-based courses (acquired by application, not bidding).
APPLICATION_SEED_NAMES = [
    r"interpersonal dynamics",
    r"private equity/venture capital lab|pe/vc lab",
    r"hacking for defense",
    r"lab in developing new products",
    r"new venture challenge",
]
