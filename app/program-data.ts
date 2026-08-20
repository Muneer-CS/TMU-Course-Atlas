export type AtlasItem = {
  code: string;
  name: string;
  type: "course" | "slot" | "work";
  slotSection?: string;
  allowedCodes?: string[];
  prerequisites?: string[];
};

export type AtlasProgram = {
  name: string;
  faculty: string;
  source: string;
  semesters: AtlasItem[][];
  coopSequence: Array<{ after: number; code: string; name: string }>;
};

const course = (code: string, name: string, prerequisites: string[] = []): AtlasItem => ({ code, name, type: "course", prerequisites });
const slot = (code: string, slotSection: string, name = "Search allowed courses", allowedCodes?: string[]): AtlasItem => ({ code, name, type: "slot", slotSection, allowedCodes });

export const programs: Record<string, AtlasProgram> = {
  cs: {
    name: "Computer Science",
    faculty: "Faculty of Science",
    source: "https://www.torontomu.ca/calendar/2026-2027/programs/science/computer_sci/",
    semesters: [
      [course("CPS 109", "Computer Science I"), course("CPS 213", "Computer Organization I"), course("MTH 110", "Discrete Mathematics I"), slot("Science Requirement", "Science Requirement", "Search allowed courses", ["BLG 143", "CHY 103", "PCS 110"]), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CPS 209", "Computer Science II", ["CPS 109"]), course("CPS 310", "Computer Organization II", ["CPS 213"]), course("CPS 412", "Social Issues, Ethics and Professionalism"), course("MTH 207", "Calculus and Computational Methods I"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CMN 300", "Communication in the Computer Industry"), course("CPS 305", "Data Structures", ["CPS 209"]), course("CPS 393", "Introduction to UNIX, C and C++", ["CPS 209"]), course("MTH 108", "Linear Algebra"), slot("Open Elective", "Open Elective")],
      [course("CPS 406", "Introduction to Software Engineering", ["CPS 305"]), course("CPS 420", "Discrete Structures", ["MTH 110"]), course("CPS 506", "Comparative Programming Languages", ["CPS 305"]), course("CPS 590", "Operating Systems I", ["CPS 393"]), course("MTH 380", "Probability and Statistics")],
      [course("CPS 510", "Database Systems I", ["CPS 305"]), course("CPS 633", "Computer Security", ["CPS 393"]), course("CPS 721", "Artificial Intelligence I", ["CPS 305"]), slot("Core Elective", "Core Elective"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CPS 616", "Algorithms", ["CPS 305"]), course("CPS 706", "Computer Networks I", ["CPS 590"]), slot("Core Elective", "Core Elective"), slot("Upper Liberal", "Upper Liberal Studies"), slot("Open Elective", "Open Elective")],
      [slot("3 Core Electives", "Core Elective"), slot("Open Elective", "Open Elective"), slot("Upper Liberal", "Upper Liberal Studies")],
      [slot("3 Core Electives", "Core Elective"), slot("Open Elective", "Open Elective"), slot("Upper Liberal", "Upper Liberal Studies")],
    ],
    coopSequence: [
      { after: 4, code: "WKT 103", name: "Work Term I" },
      { after: 4, code: "WKT 203", name: "Work Term II" },
      { after: 5, code: "WKT 303", name: "Work Term III" },
      { after: 6, code: "WKT 403", name: "Work Term IV" },
      { after: 6, code: "WKT 503", name: "Work Term V" },
    ],
  },
  computerEngineering: {
    name: "Computer Engineering",
    faculty: "Faculty of Engineering and Architectural Science",
    source: "https://www.torontomu.ca/calendar/2026-2027/programs/feas/computer_eng/",
    semesters: [
      [course("CEN 100", "Introduction to Engineering"), course("CEN 199", "Writing Skills"), course("CHY 102", "General Chemistry"), course("MTH 140", "Calculus I"), course("MTH 141", "Linear Algebra"), course("PCS 211", "Physics: Mechanics"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CPS 188", "Computer Programming Fundamentals"), course("ECN 801", "Principles of Engineering Economics"), course("ELE 202", "Electric Circuit Analysis"), course("MTH 240", "Calculus II", ["MTH 140"]), course("PCS 125", "Physics: Waves and Fields")],
      [course("COE 318", "Software Systems", ["CPS 188"]), course("COE 328", "Digital Systems"), course("ELE 302", "Electric Networks", ["ELE 202"]), course("MTH 425", "Differential Equations and Vector Calculus", ["MTH 240"]), course("PCS 224", "Solid State Physics")],
      [course("CMN 432", "Communication in Engineering"), course("COE 428", "Algorithms and Data Structures", ["COE 318"]), course("COE 528", "Object Oriented Engineering", ["COE 318"]), course("ELE 404", "Electronic Circuits I", ["ELE 302"]), course("MTH 314", "Discrete Mathematics for Engineers")],
      [course("COE 501", "Electromagnetism"), course("COE 538", "Microprocessor Systems", ["COE 328"]), course("ELE 532", "Signals and Systems I"), course("MEC 511", "Thermodynamics and Fluids"), course("MTH 514", "Probability and Stochastic Processes"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("COE 608", "Computer Organization and Architecture", ["COE 538"]), course("COE 628", "Operating Systems", ["COE 318"]), course("ELE 632", "Signals and Systems II", ["ELE 532"]), slot("2 Required Group Courses", "Required Group", "Search allowed courses", ["ELE 635", "ELE 639", "CPS 688"]), slot("Upper Liberal", "Upper Liberal Studies")],
      [course("COE 70A/B", "Computer Engineering Capstone Design"), slot("4 Core Electives", "Core Elective", "Search Table I", ["COE 718", "COE 758", "COE 768", "ELE 734", "ELE 745", "ELE 792", "ELE 809"]), slot("Engineering Liberal", "Engineering Liberal", "Search allowed courses", ["ENG 503", "GEO 702", "HST 701", "PHL 709", "POL 507"])],
      [course("CEN 800", "Law and Ethics in Engineering Practice"), course("COE 70A/B", "Computer Engineering Capstone Design"), slot("4 Core Electives", "Core Elective", "Search Table II", ["CEN 810", "COE 817", "COE 818", "COE 838", "COE 865", "ELE 882", "ELE 888"])],
    ],
    coopSequence: [{ after: 6, code: "Co-op Terms", name: "Official engineering co-op work-term sequence" }],
  },
  civil: {
    name: "Civil Engineering",
    faculty: "Faculty of Engineering and Architectural Science",
    source: "https://www.torontomu.ca/calendar/2026-2027/programs/feas/civil/",
    semesters: [
      [course("CEN 100", "Introduction to Engineering"), course("CEN 199", "Writing Skills"), course("CHY 102", "General Chemistry"), course("MTH 140", "Calculus I"), course("MTH 141", "Linear Algebra"), course("PCS 211", "Physics: Mechanics"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CPS 125", "Digital Computation and Programming"), course("CVL 207", "Graphics"), course("ECN 801", "Engineering Economics"), course("MTH 240", "Calculus II", ["MTH 140"]), course("MTL 200", "Materials Science Fundamentals"), course("PCS 125", "Physics: Waves and Fields")],
      [course("CVL 320", "Strength of Materials I"), course("CVL 323", "Fundamentals of Surveying"), course("CVL 405", "Probability and Statistics for Engineers"), course("MEC 522", "Fluid Mechanics"), course("MTH 425", "Differential Equations", ["MTH 240"])],
      [course("CMN 432", "Communication in Engineering"), course("CVL 316", "Transportation Engineering"), course("CVL 420", "Strength of Materials II", ["CVL 320"]), course("CVL 423", "Geology for Engineers"), course("CVL 434", "Geotechnical Properties of Soils"), course("CVL 502", "Hydraulic Engineering", ["MEC 522"])],
      [course("CVL 352", "Geomatics Measurement Techniques"), course("CVL 400", "Hydrology and Water Resources"), course("CVL 500", "Introduction to Structural Design", ["CVL 420"]), course("CVL 533", "Concrete Materials"), course("MTH 510", "Numerical Analysis"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("CVL 354", "Remote Sensing and Image Analysis"), course("CVL 602", "Municipal Engineering"), course("CVL 609", "Civil Engineering Systems"), course("CVL 735", "Highway Design"), course("CVL 742", "Project Management"), slot("Upper Liberal", "Upper Liberal Studies")],
      [course("CVL 650", "Satellite Positioning"), slot("Capstone Project", "Capstone Project", "Search allowed projects", ["CVL 71A/B", "CVL 72A/B"]), slot("2 Stream Electives", "Core Elective", "Search stream courses", ["CVL 903", "CVL 920", "CVL 902", "CVL 910"]), slot("Engineering Liberal", "Engineering Liberal", "Search allowed courses", ["ENG 503", "GEO 702", "HST 701", "PHL 709", "POL 507"])],
      [course("CEN 800", "Law and Ethics"), course("CVL 300", "Environmental Impact Assessment"), course("CVL 736", "Geospatial Information Systems"), slot("Continue Capstone", "Capstone Project", "Search allowed projects", ["CVL 71A/B", "CVL 72A/B"]), slot("Stream Elective", "Core Elective", "Search stream courses", ["CVL 901", "CVL 914"])],
    ],
    coopSequence: [{ after: 6, code: "Co-op Terms", name: "Official engineering co-op work-term sequence" }],
  },
  btm: {
    name: "Business Technology Management",
    faculty: "Ted Rogers School of Management",
    source: "https://www.torontomu.ca/calendar/2026-2027/programs/trsm/business_tech/",
    semesters: [
      [course("BUS 221", "Business Decision-Making"), course("CMN 279", "Professional Communication"), course("GMS 200", "Global Management"), course("ITM 100", "Foundations of Information Systems"), course("ITM 107", "Mathematics for BTM")],
      [course("ECN 104", "Introductory Microeconomics"), course("ITM 207", "Fundamentals of Information Technology"), course("MHR 405", "Organizational Behaviour"), course("QMS 210", "Applied Statistics for Business"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("ACC 100", "Introductory Financial Accounting"), course("ITM 200", "Fundamentals of Programming"), course("ITM 301", "IT Infrastructure"), course("MKT 100", "Principles of Marketing"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("ACC 406", "Management Accounting", ["ACC 100"]), course("ITM 305", "Systems Analysis and Design"), course("ITM 500", "Data and Information Management"), course("LAW 122", "Business Law"), slot("Lower Liberal", "Lower Liberal Studies")],
      [course("FIN 300", "Managerial Finance I"), course("ITM 415", "Business Process Management"), course("ITM 618", "Business Intelligence and Analytics"), slot("Upper Liberal", "Upper Liberal Studies"), slot("Core Elective", "Core Elective", "Search Table I", ["ITM 200", "ITM 315", "ITM 330", "ITM 410", "ITM 430", "ITM 445", "ITM 450", "ITM 501", "ITM 550", "ITM 610", "ITM 620", "ITM 703", "ITM 711", "ITM 733", "ITM 735", "ITM 738", "ITM 740", "ITM 745", "ITM 751", "ITM 752", "ITM 760", "ITM 775", "ITM 780", "ITM 795", "ITM 820", "ITM 825", "ITM 830", "ITM 835"])],
      [course("ECN 204", "Introductory Macroeconomics", ["ECN 104"]), course("ITM 706", "Enterprise Architecture"), course("ITM 820", "Network Security"), slot("Upper Liberal", "Upper Liberal Studies"), slot("Core Elective", "Core Elective", "Search Table I", ["ITM 200", "ITM 315", "ITM 330", "ITM 410", "ITM 430", "ITM 445", "ITM 450", "ITM 501", "ITM 550", "ITM 610", "ITM 620", "ITM 703", "ITM 711", "ITM 733", "ITM 735", "ITM 738", "ITM 740", "ITM 745", "ITM 751", "ITM 752", "ITM 760", "ITM 775", "ITM 780", "ITM 795", "ITM 820", "ITM 825", "ITM 830", "ITM 835"])],
      [course("ITM 707", "Strategy, Management and Acquisition"), course("ITM 750", "IS Project Management"), slot("Core Elective", "Core Elective", "Search Table I", ["ITM 200", "ITM 315", "ITM 330", "ITM 410", "ITM 430", "ITM 445", "ITM 450", "ITM 501", "ITM 550", "ITM 610", "ITM 620", "ITM 703", "ITM 711", "ITM 733", "ITM 735", "ITM 738", "ITM 740", "ITM 745", "ITM 751", "ITM 752", "ITM 760", "ITM 775", "ITM 780", "ITM 795", "ITM 820", "ITM 825", "ITM 830", "ITM 835"]), slot("2 Open Electives", "Open Elective")],
      [course("ITM 900", "Capstone Project"), slot("Upper Liberal", "Upper Liberal Studies"), slot("Core Elective", "Core Elective", "Search Table I", ["ITM 200", "ITM 315", "ITM 330", "ITM 410", "ITM 430", "ITM 445", "ITM 450", "ITM 501", "ITM 550", "ITM 610", "ITM 620", "ITM 703", "ITM 711", "ITM 733", "ITM 735", "ITM 738", "ITM 740", "ITM 745", "ITM 751", "ITM 752", "ITM 760", "ITM 775", "ITM 780", "ITM 795", "ITM 820", "ITM 825", "ITM 830", "ITM 835"]), slot("2 Open Electives", "Open Elective")],
    ],
    coopSequence: [
      { after: 4, code: "WKT 100", name: "Work Term I" },
      { after: 5, code: "WKT 200", name: "Work Term II" },
      { after: 6, code: "WKT 300", name: "Work Term III" },
      { after: 6, code: "WKT 400", name: "Work Term IV" },
    ],
  },
};

export const minorOptions = [
  { id: "none", name: "No minor selected", overlapByProgram: {} },
  { id: "cyber", name: "Cyber Studies", overlapByProgram: { cs: ["CPS 109", "CPS 633", "CPS 706"], btm: ["ITM 820", "ITM 825"] } },
  { id: "math", name: "Mathematics", overlapByProgram: { cs: ["MTH 110"], computerEngineering: ["MTH 314", "MTH 425", "MTH 514"], civil: ["MTH 425", "MTH 510"] } },
  { id: "business", name: "Business Essentials", overlapByProgram: { btm: ["FIN 300", "MKT 100"] } },
  { id: "marketing", name: "Marketing", overlapByProgram: { btm: ["MKT 100"] } },
  { id: "psychology", name: "Psychology", overlapByProgram: {} },
  { id: "economics", name: "Economics", overlapByProgram: { computerEngineering: ["ECN 801"], civil: ["ECN 801"], btm: ["ECN 104", "ECN 204"] } },
  { id: "geography", name: "Geographic Analysis", overlapByProgram: {} },
];
