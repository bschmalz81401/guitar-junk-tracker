/**
 * The category registry. Every category-specific difference in the app —
 * URL slug, spec sheet layout, which filters appear, which Prisma relation
 * holds the specs — is declared here, so pages and components stay generic.
 */

export type SpecFieldType = "text" | "number" | "boolean";

export interface SpecFieldDef {
  key: string;
  label: string;
  type: SpecFieldType;
  /** When type is "number", store as Int (round) instead of Float. */
  integer?: boolean;
}

export interface SpecSection {
  title: string;
  fields: SpecFieldDef[];
}

/** A category-specific filter in the list view. Matches if ANY specKey contains the value. */
export interface FilterDef {
  param: string;
  label: string;
  specKeys: string[];
}

export type CategoryKey = "guitar" | "amp" | "cab" | "pedal" | "multifx" | "other";
export type SpecRelation =
  | "guitarSpec"
  | "ampSpec"
  | "cabSpec"
  | "pedalSpec"
  | "multiFxSpec"
  | "otherSpec";

export interface CategoryDef {
  /** Value stored in Item.category */
  key: CategoryKey;
  /** URL segment, e.g. /guitars */
  slug: string;
  label: string;
  plural: string;
  blurb: string;
  /**
   * Stock photo shown on the landing-page card while the category has no gear
   * of its own. Once you add something, its primary photo takes over.
   */
  coverImage?: string;
  specRelation: SpecRelation;
  /** Overrides the label of the shared finishColor field */
  finishLabel: string;
  specSections: SpecSection[];
  filters: FilterDef[];
}

const GUITAR: CategoryDef = {
  key: "guitar",
  slug: "guitars",
  label: "Guitar",
  plural: "Guitars",
  blurb: "Electrics, acoustics and everything with strings",
  specRelation: "guitarSpec",
  finishLabel: "Finish Color",
  specSections: [
    {
      title: "Body",
      fields: [
        { key: "bodyShape", label: "Body Shape", type: "text" },
        { key: "bodyWood", label: "Body Wood", type: "text" },
        { key: "bodyTopWood", label: "Top Wood", type: "text" },
        { key: "bodyBinding", label: "Body Binding", type: "text" },
      ],
    },
    {
      title: "Neck",
      fields: [
        { key: "neckConstruction", label: "Neck Construction", type: "text" },
        { key: "neckWood", label: "Neck Wood", type: "text" },
        { key: "neckShape", label: "Neck Shape/Profile", type: "text" },
        { key: "scaleLength", label: "Scale Length", type: "text" },
        { key: "neckBinding", label: "Neck Binding", type: "text" },
      ],
    },
    {
      title: "Fingerboard",
      fields: [
        { key: "fingerboardWood", label: "Fingerboard Wood", type: "text" },
        { key: "fingerboardRadius", label: "Fingerboard Radius", type: "text" },
        { key: "fretCount", label: "Fret Count", type: "number", integer: true },
        { key: "fretSize", label: "Fret Size", type: "text" },
        { key: "nutWidth", label: "Nut Width", type: "text" },
        { key: "nutMaterial", label: "Nut Material", type: "text" },
        { key: "inlayMaterial", label: "Inlay Material", type: "text" },
        { key: "inlayStyle", label: "Inlay Style", type: "text" },
      ],
    },
    {
      title: "Hardware",
      fields: [
        { key: "bridgeType", label: "Bridge Type", type: "text" },
        { key: "tunerType", label: "Tuner Type", type: "text" },
        { key: "hardwareColor", label: "Hardware Color", type: "text" },
      ],
    },
    {
      title: "Electronics",
      fields: [
        { key: "bridgePickup", label: "Bridge Pickup", type: "text" },
        { key: "neckPickup", label: "Neck Pickup", type: "text" },
        { key: "pickupType", label: "Pickup Type", type: "text" },
        { key: "controls", label: "Controls / Wiring", type: "text" },
      ],
    },
    {
      title: "Physical & Extras",
      fields: [
        { key: "weightLbs", label: "Weight (lbs)", type: "number" },
        { key: "caseIncluded", label: "Case Included", type: "boolean" },
        { key: "caseType", label: "Case Type", type: "text" },
      ],
    },
  ],
  filters: [
    {
      param: "pickupType",
      label: "Pickup Type",
      specKeys: ["bridgePickup", "neckPickup", "pickupType"],
    },
    { param: "bridgeType", label: "Bridge Type", specKeys: ["bridgeType"] },
  ],
};

const AMP: CategoryDef = {
  key: "amp",
  slug: "amps",
  label: "Amp",
  plural: "Amps",
  blurb: "Heads and combos",
  specRelation: "ampSpec",
  finishLabel: "Finish / Color",
  specSections: [
    {
      title: "Type & Power",
      fields: [
        { key: "formFactor", label: "Form Factor", type: "text" },
        { key: "ampType", label: "Amp Type", type: "text" },
        { key: "wattage", label: "Wattage", type: "number" },
        { key: "channels", label: "Channels", type: "number", integer: true },
      ],
    },
    {
      title: "Tubes",
      fields: [
        { key: "preampTubes", label: "Preamp Tubes", type: "text" },
        { key: "powerTubes", label: "Power Tubes", type: "text" },
        { key: "rectifier", label: "Rectifier", type: "text" },
      ],
    },
    {
      title: "Speaker",
      fields: [
        { key: "speakerCount", label: "Speaker Count", type: "number", integer: true },
        { key: "speakerSize", label: "Speaker Size", type: "text" },
        { key: "speakerModel", label: "Speaker Model", type: "text" },
        { key: "impedance", label: "Impedance", type: "text" },
      ],
    },
    {
      title: "Features",
      fields: [
        { key: "eqControls", label: "EQ Controls", type: "text" },
        { key: "reverb", label: "Reverb", type: "text" },
        { key: "footswitch", label: "Footswitch", type: "text" },
        { key: "effectsLoop", label: "Effects Loop", type: "boolean" },
        { key: "masterVolume", label: "Master Volume", type: "boolean" },
        { key: "boost", label: "Boost", type: "boolean" },
        { key: "midi", label: "MIDI", type: "boolean" },
        { key: "attenuator", label: "Built-in Attenuator", type: "boolean" },
        { key: "diOut", label: "DI Out", type: "boolean" },
        { key: "cabSim", label: "Cab Sim", type: "boolean" },
      ],
    },
    {
      title: "Physical",
      fields: [
        { key: "weightLbs", label: "Weight (lbs)", type: "number" },
        { key: "dimensions", label: "Dimensions", type: "text" },
        { key: "covering", label: "Covering Material", type: "text" },
        { key: "grilleCloth", label: "Grille Cloth", type: "text" },
      ],
    },
  ],
  filters: [
    { param: "ampType", label: "Amp Type", specKeys: ["ampType"] },
    { param: "formFactor", label: "Form Factor", specKeys: ["formFactor"] },
  ],
};

const CAB: CategoryDef = {
  key: "cab",
  slug: "cabs",
  label: "Cabinet",
  plural: "Cabinets",
  blurb: "Speaker cabinets",
  specRelation: "cabSpec",
  finishLabel: "Finish / Color",
  specSections: [
    {
      title: "Speakers",
      fields: [
        { key: "speakerCount", label: "Speaker Count", type: "number", integer: true },
        { key: "speakerSize", label: "Speaker Size", type: "text" },
        { key: "speakerModel", label: "Speaker Model", type: "text" },
        { key: "cabType", label: "Cab Type", type: "text" },
      ],
    },
    {
      title: "Electrical",
      fields: [
        { key: "impedance", label: "Impedance", type: "text" },
        { key: "powerHandling", label: "Power Handling (W)", type: "number" },
        { key: "wiring", label: "Wiring", type: "text" },
        { key: "inputJacks", label: "Input Jacks", type: "text" },
        { key: "stereoCapable", label: "Stereo Capable", type: "boolean" },
      ],
    },
    {
      title: "Construction",
      fields: [
        { key: "cabWood", label: "Cabinet Wood", type: "text" },
        { key: "baffle", label: "Baffle", type: "text" },
        { key: "covering", label: "Covering Material", type: "text" },
        { key: "grilleCloth", label: "Grille Cloth", type: "text" },
        { key: "hardware", label: "Hardware", type: "text" },
        { key: "casters", label: "Casters", type: "boolean" },
      ],
    },
    {
      title: "Physical",
      fields: [
        { key: "weightLbs", label: "Weight (lbs)", type: "number" },
        { key: "dimensions", label: "Dimensions", type: "text" },
      ],
    },
  ],
  filters: [
    { param: "speakerSize", label: "Speaker Size", specKeys: ["speakerSize"] },
    { param: "cabType", label: "Cab Type", specKeys: ["cabType"] },
  ],
};

const PEDAL: CategoryDef = {
  key: "pedal",
  slug: "pedals",
  label: "Pedal",
  plural: "Pedals",
  blurb: "Stompboxes and effects",
  specRelation: "pedalSpec",
  finishLabel: "Enclosure Color",
  specSections: [
    {
      title: "Type",
      fields: [
        { key: "effectType", label: "Effect Type", type: "text" },
        { key: "circuitType", label: "Circuit", type: "text" },
        { key: "trueBypass", label: "True Bypass", type: "boolean" },
      ],
    },
    {
      title: "Controls",
      fields: [
        { key: "knobs", label: "Knobs", type: "text" },
        { key: "switches", label: "Switches", type: "text" },
        { key: "presets", label: "Presets", type: "text" },
        { key: "expressionInput", label: "Expression Input", type: "boolean" },
        { key: "tapTempo", label: "Tap Tempo", type: "boolean" },
      ],
    },
    {
      title: "I/O & Power",
      fields: [
        { key: "inputs", label: "Inputs", type: "text" },
        { key: "outputs", label: "Outputs", type: "text" },
        { key: "stereo", label: "Stereo", type: "boolean" },
        { key: "midi", label: "MIDI", type: "boolean" },
        { key: "powerRequired", label: "Power Required", type: "text" },
        { key: "currentDraw", label: "Current Draw (mA)", type: "number", integer: true },
        { key: "batteryOption", label: "Battery Option", type: "boolean" },
      ],
    },
    {
      title: "Physical",
      fields: [
        { key: "enclosureSize", label: "Enclosure Size", type: "text" },
        { key: "dimensions", label: "Dimensions", type: "text" },
        { key: "weightLbs", label: "Weight (lbs)", type: "number" },
      ],
    },
  ],
  filters: [
    { param: "effectType", label: "Effect Type", specKeys: ["effectType"] },
    { param: "circuitType", label: "Circuit", specKeys: ["circuitType"] },
  ],
};

/**
 * Spec fields from the first column of the Line 6 Processors Comparison Chart
 * (Amp Models … Product Weight).
 */
const MULTIFX: CategoryDef = {
  key: "multifx",
  slug: "multi-fx",
  label: "Multi FX",
  plural: "Multi FX",
  blurb: "Modelers, multi-effects and floor processors",
  specRelation: "multiFxSpec",
  finishLabel: "Finish / Color",
  specSections: [
    {
      title: "Models & Processing",
      fields: [
        { key: "ampModels", label: "Amp Models", type: "text" },
        { key: "effectModels", label: "Effect Models", type: "text" },
        { key: "presets", label: "Presets", type: "text" },
        { key: "processingBlocks", label: "Simultaneous Processing Blocks", type: "text" },
        { key: "signalFlowOptions", label: "Signal Flow Options", type: "text" },
        { key: "snapshots", label: "Snapshots", type: "text" },
        { key: "impulseResponses", label: "Impulse Responses (IRs)", type: "text" },
        { key: "globalEqBands", label: "Global EQ Bands", type: "text" },
      ],
    },
    {
      title: "Controls & Display",
      fields: [
        { key: "mainDisplay", label: "Main Display (in/cm)", type: "text" },
        { key: "footswitches", label: "Footswitches", type: "text" },
        { key: "footswitchModes", label: "Footswitch Modes", type: "text" },
        { key: "footswitchTypes", label: "Footswitch Types", type: "text" },
        { key: "looperTypes", label: "Looper Types", type: "text" },
        { key: "looperMemoryFull", label: "Looper Memory (Full Speed)", type: "text" },
        { key: "looperMemoryHalf", label: "Looper Memory (1/2 Speed)", type: "text" },
        { key: "scribbleStripLcds", label: "Scribble Strip LCDs", type: "text" },
        { key: "treadle", label: "Treadle", type: "text" },
      ],
    },
    {
      title: "I/O & Connectivity",
      fields: [
        { key: "quarterInchInputs", label: '1/4" Inputs', type: "text" },
        { key: "quarterInchOutputs", label: '1/4" Outputs', type: "text" },
        { key: "xlrInputs", label: "XLR Inputs", type: "text" },
        { key: "xlrOutputs", label: "XLR Outputs", type: "text" },
        { key: "effectLoops", label: "Effect Loop(s)", type: "text" },
        { key: "digitalIn", label: "Digital In", type: "text" },
        { key: "digitalOut", label: "Digital Out", type: "text" },
        { key: "headphones", label: "Headphones", type: "text" },
        { key: "midi", label: "MIDI", type: "text" },
        { key: "usbAudioInterface", label: "USB Audio Interface", type: "text" },
        { key: "masterRemoteControl", label: "Master Remote Control", type: "text" },
        { key: "variableImpedance", label: "Variable Impedance Circuitry", type: "text" },
        { key: "expPedalInputs", label: '1/4" Exp Pedal Inputs', type: "text" },
        { key: "externalAmpControl", label: "External Amp Control Outputs", type: "text" },
      ],
    },
    {
      title: "Wireless & Power",
      fields: [
        { key: "wirelessTransmitter", label: "G10T Wireless Transmitter", type: "text" },
        { key: "wirelessReceiver", label: "Relay Wireless Receiver", type: "text" },
        { key: "power", label: "Power", type: "text" },
      ],
    },
    {
      title: "Physical",
      fields: [
        { key: "chassis", label: "Chassis", type: "text" },
        { key: "height", label: "Product Height (in/mm)", type: "text" },
        { key: "width", label: "Product Width (in/mm)", type: "text" },
        { key: "depth", label: "Product Depth (in/mm)", type: "text" },
        { key: "weightLbs", label: "Product Weight (lb/kg)", type: "text" },
      ],
    },
  ],
  filters: [
    { param: "ampModels", label: "Amp Models", specKeys: ["ampModels"] },
    { param: "effectModels", label: "Effect Models", specKeys: ["effectModels"] },
  ],
};

const OTHER: CategoryDef = {
  key: "other",
  slug: "other",
  label: "Other",
  plural: "Other",
  blurb: "Straps, cables, stands and everything else",
  specRelation: "otherSpec",
  finishLabel: "Color",
  specSections: [
    {
      title: "Details",
      fields: [
        { key: "itemType", label: "Item Type", type: "text" },
        { key: "material", label: "Material", type: "text" },
        { key: "powerRequired", label: "Power Required", type: "text" },
        { key: "dimensions", label: "Dimensions", type: "text" },
        { key: "weightLbs", label: "Weight (lbs)", type: "number" },
        { key: "details", label: "Other Specs", type: "text" },
      ],
    },
  ],
  filters: [{ param: "itemType", label: "Item Type", specKeys: ["itemType"] }],
};

export const CATEGORY_LIST: CategoryDef[] = [GUITAR, AMP, CAB, PEDAL, MULTIFX, OTHER];

export const CATEGORIES_BY_SLUG: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.slug, c])
);

export const CATEGORIES_BY_KEY: Record<CategoryKey, CategoryDef> = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.key, c])
) as Record<CategoryKey, CategoryDef>;

export function categoryBySlug(slug: string): CategoryDef | null {
  return CATEGORIES_BY_SLUG[slug] ?? null;
}

export function categoryByKey(key: string): CategoryDef | null {
  return CATEGORIES_BY_KEY[key as CategoryKey] ?? null;
}

export function specFieldKeys(category: CategoryDef): string[] {
  return category.specSections.flatMap((s) => s.fields.map((f) => f.key));
}

function specFieldMap(category: CategoryDef): Record<string, SpecFieldDef> {
  return Object.fromEntries(
    category.specSections.flatMap((s) => s.fields.map((f) => [f.key, f]))
  );
}

/**
 * Coerces raw request-body spec values to what the Prisma schema expects.
 * Form inputs submit numbers as strings and cleared fields as "", so numeric
 * fields are parsed and empty values become null.
 */
export function buildSpecData(
  category: CategoryDef,
  body: Record<string, unknown>
): Record<string, unknown> {
  const fields = specFieldMap(category);
  const data: Record<string, unknown> = {};

  for (const key of specFieldKeys(category)) {
    if (!(key in body)) continue;
    const raw = body[key];
    const def = fields[key];
    const type = def.type;

    if (type === "boolean") {
      data[key] = Boolean(raw);
    } else if (type === "number") {
      if (raw === "" || raw === null || raw === undefined) {
        data[key] = null;
      } else {
        const num = Number(raw);
        data[key] = Number.isNaN(num) ? null : def.integer ? Math.round(num) : num;
      }
    } else {
      data[key] = raw === "" || raw === null || raw === undefined ? null : String(raw);
    }
  }

  return data;
}

export const ITEM_STATUSES = ["owned", "sold", "wishlist"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
