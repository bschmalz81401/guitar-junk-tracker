import type { CategoryKey } from "@/types/categories";

export interface SynonymEntry {
  field: string;
  patterns: string[];
}

/**
 * Label synonyms per category. Keys may be core Item fields (series,
 * finishColor) as well as spec fields — the form merges both.
 */
/** Core item identity labels (Amazon / retailer product info tables). */
const IDENTITY: SynonymEntry[] = [
  { field: "brand", patterns: ["brand name", "brand", "manufacturer brand"] },
  {
    field: "model",
    patterns: ["item model number", "model number", "model name", "model"],
  },
];

const SHARED_META: SynonymEntry[] = [
  { field: "weightLbs", patterns: ["item weight", "product weight", "net weight", "weight"] },
  {
    field: "dimensions",
    patterns: [
      "product dimensions",
      "item dimensions",
      "package dimensions",
      "dimensions",
      "size",
    ],
  },
];

export const SYNONYMS: Record<CategoryKey, SynonymEntry[]> = {
  guitar: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    { field: "finishColor", patterns: ["finish color", "finish", "color", "colour"] },
    { field: "bodyShape", patterns: ["body shape", "body style"] },
    { field: "bodyWood", patterns: ["body wood", "body material", "body"] },
    { field: "bodyTopWood", patterns: ["top wood", "body top", "top material"] },
    { field: "bodyBinding", patterns: ["body binding"] },
    {
      field: "neckConstruction",
      patterns: ["neck construction", "neck joint", "neck attachment", "neck type"],
    },
    { field: "neckWood", patterns: ["neck wood", "neck material"] },
    { field: "neckShape", patterns: ["neck shape", "neck profile", "neck carve"] },
    { field: "scaleLength", patterns: ["scale length", "scale"] },
    { field: "neckBinding", patterns: ["neck binding"] },
    {
      field: "fingerboardWood",
      patterns: [
        "fingerboard material",
        "fingerboard wood",
        "fretboard material",
        "fretboard wood",
        "fingerboard",
        "fretboard",
      ],
    },
    { field: "fingerboardRadius", patterns: ["fingerboard radius", "fretboard radius", "radius"] },
    { field: "fretCount", patterns: ["number of frets", "fret count", "frets"] },
    { field: "fretSize", patterns: ["fret size", "fret type"] },
    { field: "nutWidth", patterns: ["nut width"] },
    { field: "nutMaterial", patterns: ["nut material", "nut"] },
    { field: "inlayMaterial", patterns: ["inlay material"] },
    {
      field: "inlayStyle",
      patterns: ["fingerboard inlay", "position markers", "position inlay", "inlays", "inlay"],
    },
    { field: "bridgeType", patterns: ["bridge type", "bridge"] },
    { field: "tunerType", patterns: ["tuning machines", "machine heads", "tuners", "tuner"] },
    {
      field: "hardwareColor",
      patterns: ["hardware color", "hardware finish", "hardware colour", "hardware"],
    },
    { field: "bridgePickup", patterns: ["bridge pickup"] },
    { field: "neckPickup", patterns: ["neck pickup"] },
    {
      field: "pickupType",
      patterns: ["pickup configuration", "pickup type", "pickups", "electronics"],
    },
    { field: "controls", patterns: ["control layout", "controls", "wiring"] },
    ...SHARED_META,
    { field: "caseIncluded", patterns: ["case included", "hardshell case", "gig bag included"] },
    { field: "caseType", patterns: ["included case", "case/gig bag", "case type", "case"] },
  ],

  amp: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    { field: "finishColor", patterns: ["finish color", "finish", "color", "colour"] },
    {
      field: "formFactor",
      patterns: ["form factor", "configuration", "amplifier format", "format", "head/combo"],
    },
    {
      field: "ampType",
      patterns: ["amp type", "amplifier type", "technology", "circuit type", "type"],
    },
    {
      field: "wattage",
      patterns: [
        "output wattage",
        "power output",
        "output power",
        "rated power",
        "wattage",
        "watts",
        "power",
      ],
    },
    { field: "channels", patterns: ["number of channels", "channels", "channel"] },
    { field: "preampTubes", patterns: ["preamp tubes", "preamp valves", "preamp tube"] },
    {
      field: "powerTubes",
      patterns: ["power tubes", "power valves", "output tubes", "power amp tubes"],
    },
    { field: "rectifier", patterns: ["rectifier tube", "rectifier"] },
    { field: "speakerCount", patterns: ["number of speakers", "speaker count"] },
    { field: "speakerSize", patterns: ["speaker size", "speaker diameter"] },
    { field: "speakerModel", patterns: ["speaker model", "speakers", "speaker"] },
    { field: "impedance", patterns: ["speaker impedance", "output impedance", "impedance"] },
    { field: "eqControls", patterns: ["eq controls", "tone controls", "equalization", "eq"] },
    { field: "reverb", patterns: ["reverb"] },
    { field: "footswitch", patterns: ["footswitch", "foot switch"] },
    { field: "effectsLoop", patterns: ["effects loop", "fx loop", "effect loop"] },
    { field: "masterVolume", patterns: ["master volume", "master vol"] },
    { field: "boost", patterns: ["boost", "solo boost", "gain boost"] },
    { field: "midi", patterns: ["midi"] },
    { field: "attenuator", patterns: ["attenuator", "power soak", "power scaling"] },
    {
      field: "diOut",
      patterns: ["di out", "xlr out", "direct out", "line out", "line output", "balanced out"],
    },
    {
      field: "cabSim",
      patterns: ["cab sim", "cabinet simulation", "speaker simulation", "ir loader", "ir"],
    },
    ...SHARED_META,
    { field: "covering", patterns: ["covering", "tolex", "cabinet covering"] },
    { field: "grilleCloth", patterns: ["grille cloth", "grill cloth", "grille", "grill"] },
  ],

  cab: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    { field: "finishColor", patterns: ["finish color", "finish", "color", "colour"] },
    { field: "speakerCount", patterns: ["number of speakers", "speaker count", "configuration"] },
    { field: "speakerSize", patterns: ["speaker size", "speaker diameter"] },
    { field: "speakerModel", patterns: ["speaker model", "speakers", "speaker", "drivers"] },
    {
      field: "cabType",
      patterns: ["cabinet type", "enclosure type", "back panel", "cab type", "enclosure"],
    },
    { field: "impedance", patterns: ["impedance", "nominal impedance"] },
    {
      field: "powerHandling",
      patterns: ["power handling", "power rating", "rms power", "power capacity"],
    },
    { field: "wiring", patterns: ["speaker wiring", "wiring"] },
    { field: "inputJacks", patterns: ["input jacks", "inputs", "jacks", "connectors"] },
    { field: "stereoCapable", patterns: ["stereo", "mono/stereo", "stereo capable"] },
    {
      field: "cabWood",
      patterns: ["cabinet wood", "cabinet material", "construction", "material", "wood"],
    },
    { field: "baffle", patterns: ["baffle"] },
    { field: "covering", patterns: ["covering", "tolex", "cabinet covering"] },
    { field: "grilleCloth", patterns: ["grille cloth", "grill cloth", "grille", "grill"] },
    { field: "hardware", patterns: ["hardware", "corners", "handles"] },
    { field: "casters", patterns: ["casters", "wheels"] },
    ...SHARED_META,
  ],

  pedal: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    {
      field: "finishColor",
      patterns: ["finish color", "finish", "enclosure color", "color", "colour"],
    },
    { field: "effectType", patterns: ["effect type", "pedal type", "effect", "type"] },
    {
      field: "circuitType",
      patterns: ["circuit type", "circuit", "technology", "analog/digital"],
    },
    { field: "trueBypass", patterns: ["true bypass", "bypass type", "bypass"] },
    { field: "knobs", patterns: ["knobs", "controls", "control knobs"] },
    { field: "switches", patterns: ["switches", "footswitches", "footswitch", "switch"] },
    { field: "presets", patterns: ["presets", "preset slots", "memory"] },
    { field: "expressionInput", patterns: ["expression input", "expression pedal", "exp input"] },
    { field: "tapTempo", patterns: ["tap tempo"] },
    { field: "inputs", patterns: ["input jacks", "inputs", "input"] },
    { field: "outputs", patterns: ["output jacks", "outputs", "output"] },
    { field: "stereo", patterns: ["stereo"] },
    { field: "midi", patterns: ["midi"] },
    {
      field: "powerRequired",
      patterns: ["power supply", "power requirements", "power required", "voltage", "power"],
    },
    {
      field: "currentDraw",
      patterns: ["current draw", "current consumption", "power consumption", "milliamps"],
    },
    { field: "batteryOption", patterns: ["battery operation", "battery"] },
    { field: "enclosureSize", patterns: ["enclosure size", "enclosure", "housing"] },
    ...SHARED_META,
  ],

  multifx: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    { field: "finishColor", patterns: ["finish color", "finish", "color", "colour"] },
    { field: "ampModels", patterns: ["amp models", "amplifier models", "amps"] },
    {
      field: "effectModels",
      patterns: ["effect models", "effects models", "effects", "fx models"],
    },
    { field: "presets", patterns: ["presets", "preset slots", "preset count"] },
    {
      field: "processingBlocks",
      patterns: [
        "simultaneous processing blocks",
        "simultanious processing blocks",
        "processing blocks",
        "dynamic blocks",
        "dsp blocks",
        "blocks",
      ],
    },
    {
      field: "signalFlowOptions",
      patterns: ["signal flow options", "signal flow", "signal paths", "routing"],
    },
    { field: "snapshots", patterns: ["snapshots", "snapshot"] },
    {
      field: "impulseResponses",
      patterns: ["impulse responses (irs)", "impulse responses", "irs", "ir loader"],
    },
    {
      field: "globalEqBands",
      patterns: ["global eq bands", "global eq", "eq bands"],
    },
    {
      field: "mainDisplay",
      patterns: ["main display (in/cm)", "main display", "display", "touchscreen", "screen"],
    },
    {
      field: "footswitches",
      patterns: ["footswitches", "footswitch", "foot switches"],
    },
    {
      field: "footswitchModes",
      patterns: ["footswitch modes", "switch modes"],
    },
    {
      field: "footswitchTypes",
      patterns: ["footswitch types", "switch types"],
    },
    { field: "looperTypes", patterns: ["looper types", "looper type", "looper"] },
    {
      field: "looperMemoryFull",
      patterns: ["looper memory (full speed)", "looper memory full speed", "looper memory"],
    },
    {
      field: "looperMemoryHalf",
      patterns: ["looper memory (1/2 speed)", "looper memory half speed", "looper 1/2 speed"],
    },
    {
      field: "quarterInchInputs",
      patterns: ['1/4" inputs', "1/4 inputs", "quarter inch inputs", "instrument inputs", "inputs"],
    },
    {
      field: "quarterInchOutputs",
      patterns: ['1/4" outputs', "1/4 outputs", "quarter inch outputs", "main outputs", "outputs"],
    },
    {
      field: "xlrInputs",
      patterns: ["xlr inputs", "xlr input", "microphone input", "mic input", "mic pre"],
    },
    {
      field: "xlrOutputs",
      patterns: ["xlr outputs", "xlr output", "balanced outputs"],
    },
    {
      field: "effectLoops",
      patterns: ["effect loop(s)", "effect loops", "effects loop", "fx loop", "send/return", "send return"],
    },
    {
      field: "digitalIn",
      patterns: ["digital in", "digital input", "s/pdif in", "spdif in", "aes in", "variax"],
    },
    {
      field: "digitalOut",
      patterns: ["digital out", "digital output", "s/pdif out", "spdif out", "aes out", "l6 link"],
    },
    {
      field: "headphones",
      patterns: ["headphones", "headphone output", "headphone out", "phone out"],
    },
    { field: "midi", patterns: ["midi", "midi din", "midi in/out/thru"] },
    {
      field: "usbAudioInterface",
      patterns: ["usb audio interface", "usb audio", "usb interface", "usb"],
    },
    {
      field: "masterRemoteControl",
      patterns: ["master remote control", "command center", "remote control"],
    },
    {
      field: "variableImpedance",
      patterns: ["variable impedance circuitry", "variable impedance", "impedance circuitry"],
    },
    { field: "chassis", patterns: ["chassis", "construction", "enclosure"] },
    { field: "treadle", patterns: ["treadle", "expression pedal built-in", "built-in expression"] },
    {
      field: "scribbleStripLcds",
      patterns: ["scribble strip lcds", "scribble strips", "scribble strip", "oled scribble"],
    },
    {
      field: "expPedalInputs",
      patterns: [
        '1/4" exp pedal inputs',
        "exp pedal inputs",
        "expression pedal inputs",
        "expression pedal",
        "exp inputs",
      ],
    },
    {
      field: "externalAmpControl",
      patterns: [
        "external amp control outputs",
        "external amp control",
        "amp control outputs",
        "amp control",
      ],
    },
    {
      field: "wirelessTransmitter",
      patterns: ["g10t wireless transmitter", "wireless transmitter", "g10t", "g10"],
    },
    {
      field: "wirelessReceiver",
      patterns: ["relay wireless receiver", "wireless receiver", "relay receiver"],
    },
    { field: "power", patterns: ["power", "power supply", "power requirements"] },
    {
      field: "height",
      patterns: ["product height (in/mm)", "product height", "height"],
    },
    {
      field: "width",
      patterns: ["product width (in/mm)", "product width", "width"],
    },
    {
      field: "depth",
      patterns: ["product depth (in/mm)", "product depth", "depth"],
    },
    {
      field: "weightLbs",
      patterns: ["product weight (lb/kg)", "item weight", "product weight", "weight"],
    },
  ],

  other: [
    ...IDENTITY,
    { field: "series", patterns: ["series"] },
    { field: "finishColor", patterns: ["finish color", "finish", "color", "colour"] },
    {
      field: "itemType",
      patterns: ["item type", "product type", "type", "category", "gear type"],
    },
    { field: "material", patterns: ["material", "construction", "fabric"] },
    {
      field: "powerRequired",
      patterns: ["power supply", "power requirements", "power required", "voltage", "power"],
    },
    ...SHARED_META.filter((e) => e.field !== "weightLbs"),
    { field: "dimensions", patterns: ["product dimensions", "item dimensions", "dimensions", "size", "length"] },
    { field: "weightLbs", patterns: ["item weight", "product weight", "weight"] },
    { field: "details", patterns: ["details", "specifications", "specs", "features", "description"] },
  ],
};
