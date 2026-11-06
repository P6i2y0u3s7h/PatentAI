"""
Script to expand patents.csv with 28 detailed, realistic technical patents
across Healthcare, AI, Cybersecurity, Clean Energy, Robotics, and Semiconductors,
and then rebuild the FAISS vector index and metadata pickle.
"""

import sys
import csv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CSV_PATH = DATA_DIR / "patents.csv"

NEW_PATENTS = [
    {
        "id": "US-2026-003",
        "title": "Continuous Non-Invasive Glucose Monitoring Using Multi-Wavelength Optical Spectroscopy",
        "abstract": "A wearable medical sensor device utilizing multi-wavelength near-infrared spectroscopy and deep temporal neural networks to determine blood glucose concentration transdermally without skin puncture.",
        "description": "The non-invasive glucose monitoring system comprises an optical sensor array configured with four distinct NIR laser diodes operating between 900nm and 1700nm. Reflected light from subdermal capillaries is captured by an avalanche photodiode array at 100Hz. Skin temperature, hydration level, and motion artifacts are measured via auxiliary micro-sensors to provide dynamic baseline correction. A dual-stage convolutional and recurrent neural network decouples the glucose absorption signature from baseline physiological variations, achieving a mean absolute relative difference (MARD) of 7.2% against laboratory blood draw references. An embedded ultra-low power microcontroller computes real-time glucose estimates every 30 seconds and broadcasts alerts via encrypted Bluetooth Low Energy (BLE) to an insulin pump or mobile device.",
        "assignee": "BioSense Medical Devices",
        "publication_date": "2026-03-01",
        "country": "US",
        "ipc_class": "A61B 5/145",
    },
    {
        "id": "US-2026-004",
        "title": "All-Solid-State Lithium Metal Battery with Sulfide Electrolyte and 3D Porous Anode Host",
        "abstract": "A high-energy-density solid-state battery featuring a sulfide-based ceramic electrolyte and a porous three-dimensional lithium-host scaffold that prevents lithium dendrite penetration and accommodates volume expansion during ultra-fast charging.",
        "description": "The present invention relates to an all-solid-state secondary lithium battery operating with an energy density exceeding 500 Wh/kg. The solid electrolyte layer comprises a lithium phosphorus sulfur chloride (LPSC) argyrodite ceramic with ionic conductivity of 12 mS/cm at 25°C, surface-passivated with atomic layer deposition (ALD) aluminum oxide. The anode utilizes a 3D porous carbon nanotube and nickel foam framework infused with lithiophilic gold seeds, suppressing dendrite propagation even at critical current densities of 15 mA/cm2. The cathode comprises nickel-rich LiNi0.9Co0.05Mn0.05O2 (NCM90) particles uniformly coated with lithium niobium oxide (LNO) to eliminate interfacial side reactions. The battery demonstrates greater than 90% capacity retention after 1,200 fast-charge cycles at 4C rate under 5 MPa stack pressure.",
        "assignee": "SolidVolt Energy Technologies",
        "publication_date": "2026-03-15",
        "country": "US",
        "ipc_class": "H01M 10/0525",
    },
    {
        "id": "US-2026-005",
        "title": "Retrieval-Augmented Generation (RAG) System with Dynamic Chunk Reranking and Semantic Hallucination Filter",
        "abstract": "An enterprise natural language retrieval-augmented generation architecture that extracts contextual document chunks, computes bidirectional relevance scores with a cross-encoder reranker, and verifies factual grounding through knowledge graph entailment before generating responses.",
        "description": "The system provides a high-fidelity retrieval-augmented generation (RAG) pipeline for large-scale enterprise knowledge bases. Input queries are expanded using multi-perspective query decomposition and projected into a dense vector space using a 768-dimensional bi-encoder. Initial candidate retrieval queries an approximate nearest neighbor index combining HNSW graphs with BM25 inverted lexical indices via reciprocal rank fusion (RRF). Retrieved chunks are dynamically rescored using a cross-encoder model that evaluates query-passage entailment. Prior to token generation, an adversarial verification layer cross-checks candidate facts against an extracted entity-relation knowledge graph to detect and suppress hallucinations. The resulting generative context maximizes factual consistency by 44% compared to standard vector similarity retrieval while maintaining sub-200ms latency.",
        "assignee": "CognitiveGraph AI Inc.",
        "publication_date": "2026-03-22",
        "country": "US",
        "ipc_class": "G06F 16/33",
    },
    {
        "id": "US-2026-006",
        "title": "Low-Rank Adaptation (LoRA) Architecture for On-Device Large Language Model Fine-Tuning",
        "abstract": "A parameter-efficient fine-tuning mechanism for transformer large language models using dynamically partitioned low-rank matrix decomposition with INT4 quantized base weights, enabling real-time local model adaptation on edge hardware.",
        "description": "This disclosure provides systems and methods for localized parameter-efficient fine-tuning (PEFT) on memory-constrained mobile and embedded processors. The architecture decomposes attention weight update matrices into products of rank-8 adapter matrices while retaining base transformer weights in 4-bit normal float (NF4) quantization. A gradient tracking scheduler determines optimal adapter rank per attention head based on task-specific Fisher information matrices. Forward passes execute via fused kernel operations combining quantized matrix multiplication with FP16 adapter accumulation, reducing VRAM footprint by 78% compared to standard 16-bit fine-tuning. The system enables continuous task personalization and privacy-preserving federated adapter updates without transmitting underlying user conversational data.",
        "assignee": "EdgeNeural Microelectronics",
        "publication_date": "2026-04-02",
        "country": "US",
        "ipc_class": "G06N 20/02",
    },
    {
        "id": "US-2026-007",
        "title": "Targeted mRNA Drug Delivery Vehicle with Lipid Nanoparticles and Organ-Specific Ligands",
        "abstract": "Ionizable lipid nanoparticle formulations encapsulating therapeutic messenger RNA with engineered surface-targeting peptides for cell-specific delivery to hepatic and pulmonary tissues without systemic cytotoxicity.",
        "description": "The invention discloses a pharmaceutical composition comprising lipid nanoparticles (LNPs) tailored for cell-targeted therapeutic nucleic acid delivery. The nanoparticle core contains an ionizable amino-lipid possessing an apparent pKa of 6.3 to 6.8, cholesterol, distearoylphosphatidylcholine (DSPC), and polyethylene glycol-dimyristoylglycerol (PEG-DMG) at an optimized molar ratio of 50:38.5:10:1.5. Synthetic targeting peptides conjugated to the distal terminus of the PEG lipids bind specifically to asialoglycoprotein receptors (ASGPR) on hepatocytes or surfactant protein receptors on alveolar epithelial cells. The formulation encapsulates synthetic mRNA encoding therapeutic enzymes or antigens with encapsulation efficiency greater than 96%. Systemic administration shows over 15-fold higher organ-selective protein expression relative to non-targeted lipid formulations with minimal immune activation.",
        "assignee": "NanoTherapeutics Biosystems",
        "publication_date": "2026-04-10",
        "country": "US",
        "ipc_class": "A61K 9/51",
    },
    {
        "id": "US-2026-008",
        "title": "Perovskite-Silicon Tandem Photovoltaic Cell with Multi-Junction Gradient Bandgap",
        "abstract": "A high-efficiency tandem solar cell combining a wide-bandgap metal halide perovskite top cell and a textured bottom silicon heterojunction cell with a transparent conductive oxide recombination layer, achieving over 33% power conversion efficiency.",
        "description": "A monolithic two-terminal tandem solar cell is disclosed. The device comprises a bottom passivated emitter rear locally diffused (PERL) or heterojunction (SHJ) n-type silicon wafer having a bandgap of 1.12 eV. A 15nm thick indium zinc oxide (IZO) tunneling recombination junction connects the bottom cell to a solution-processed mixed-cation lead-halide perovskite top absorber having a tunable bandgap of 1.68 eV. The perovskite layer is passivated with 2D phenethylammonium iodide (PEAI) nanosheets to minimize non-radiative interfacial recombination and ion migration. An anti-reflective textured polydimethylsiloxane (PDMS) light-trapping foil is laminated to the front glass. The tandem cell achieves a certified power conversion efficiency of 33.4% under AM 1.5G standard illumination and retains 95% of initial efficiency after 2000 hours of continuous operational damp-heat testing.",
        "assignee": "HelioNova Photovoltaics",
        "publication_date": "2026-04-18",
        "country": "US",
        "ipc_class": "H01L 31/0725",
    },
    {
        "id": "US-2026-009",
        "title": "Zero-Trust Architecture for Microsegmentation Using Continuous Behavioral Identity Verification",
        "abstract": "An enterprise cybersecurity architecture enforcing zero-trust network access through continuous machine learning evaluation of user telemetry, API call graphs, and biometric behavior, executing dynamic microsegmentation policies in real-time.",
        "description": "The system provides continuous verification and granular microsegmentation across distributed hybrid cloud infrastructure. A kernel-level lightweight eBPF sensor intercepts network sockets, system calls, and authentication events on every workload node. A streaming anomaly detector evaluates multi-dimensional feature vectors including typing cadence, mouse dynamics, IP geo-velocity, and inter-service API call sequences against personalized baseline distributions. Upon detecting a statistical confidence drop below a dynamic risk threshold, the policy engine automatically revokes OAuth tokens, isolates the affected container via software-defined network (SDN) rules, and elevates authentication requirements without disrupting unrelated enterprise services. Zero-trust validation occurs continuously at packet-level granularity with less than 2ms latency penalty.",
        "assignee": "CyberArmor Networks",
        "publication_date": "2026-04-25",
        "country": "US",
        "ipc_class": "H04L 9/40",
    },
    {
        "id": "US-2026-010",
        "title": "Post-Quantum Cryptographic Processor for Module-Lattice Key Encapsulation and Digital Signatures",
        "abstract": "A cryptographic coprocessor ASIC implementing hardware acceleration for post-quantum lattice-based algorithms ML-KEM (Kyber) and ML-DSA (Dilithium) with side-channel attack countermeasures.",
        "description": "The cryptographic accelerator comprises dedicated dual-core arithmetic units optimized for polynomial arithmetic over polynomial rings Zq[X]/(X^n + 1) with n=256. A unified Number Theoretic Transform (NTT) pipeline processes forward and inverse transforms for Kyber-768/1024 and Dilithium-3/5 in 140 clock cycles. A cryptographically secure true random number generator (TRNG) feeds a centered binomial distribution sampler for noise polynomial generation. Hardware countermeasures against power analysis and electromagnetic side-channel attacks include first-order Boolean-to-arithmetic masking and random jitter clock insertion. Key encapsulation generates shared secrets in 4.2 microseconds at 200MHz while consuming under 45 milliwatts, providing NIST-approved post-quantum security against future quantum computer attacks.",
        "assignee": "QuantumShield Cryptosystems",
        "publication_date": "2026-05-02",
        "country": "US",
        "ipc_class": "H04L 9/00",
    },
    {
        "id": "US-2026-011",
        "title": "Gate-All-Around (GAA) Nanosheet Transistor with Sub-2nm Dielectric Isolation",
        "abstract": "A semiconductor field-effect transistor structure featuring vertically stacked silicon-germanium nanosheets fully wrapped by high-k metal gates with inner dielectric spacers for leakage current reduction in sub-2nm node ICs.",
        "description": "The patent discloses a gate-all-around (GAA) field-effect transistor (FET) architecture for advanced sub-2nm integrated circuits. The channel consists of four vertically stacked silicon nanosheets having a thickness of 5nm and a sheet width of 25nm, separated by 8nm vertical gate pitches. Inner spacers formed of low-k silicon borocarbonitride (SiBCN) isolate the gate conductor from source/drain epitaxy, reducing parasitic capacitance by 28%. A work-function metal stack comprising alternating layers of titanium nitride (TiN) and aluminum carbide (TiAlC) provides symmetrical threshold voltages for n-type and p-type devices. The nanosheet channel demonstrates a subthreshold swing of 65 mV/decade and drive currents exceeding 1.8 mA/um at 0.7V supply voltage, eliminating short-channel effects prevalent in conventional FinFET geometries.",
        "assignee": "NanoGate Microelectronics",
        "publication_date": "2026-05-10",
        "country": "US",
        "ipc_class": "H01L 29/775",
    },
    {
        "id": "US-2026-012",
        "title": "Autonomous Drone Obstacle Avoidance Using Neuromorphic Event Cameras and Spiking Flow Tracking",
        "abstract": "An obstacle sensing and avoidance system for unmanned aerial vehicles using high-temporal-resolution event-based sensors and a spiking neural network that achieves microsecond-level collision avoidance at high flight speeds.",
        "description": "The system couples a bio-inspired neuromorphic event sensor (dynamic vision sensor) capturing asynchronous pixel brightness changes with 1-microsecond temporal resolution with an onboard neuromorphic processor. An asynchronous event-based optical flow algorithm computes time-to-contact vectors for approaching obstacles across a 160-degree field of view. A 3-layer spiking neural network directly maps spatial-temporal event clusters into brushless motor thrust and yaw command modifications without frame-based buffering. The architecture enables collision-free navigation through dense forest canopies and indoor environments at speeds exceeding 20 meters per second under rapid illumination transitions from direct sunlight to pitch darkness, consuming under 2.5 watts total sensor and processing power.",
        "assignee": "AeroVect Neuromorphics",
        "publication_date": "2026-05-18",
        "country": "US",
        "ipc_class": "B64C 39/02",
    },
    {
        "id": "US-2026-013",
        "title": "Patient Sepsis Early-Warning Detection via Multi-Parameter Vital Sign Stream Analysis",
        "abstract": "A clinical real-time early warning system using transformer sequence models on physiological telemetry (heart rate variability, respiration, blood pressure, end-tidal CO2) to predict septic shock 12 hours prior to clinical onset.",
        "description": "The invention provides an algorithmic clinical decision support system connected to hospital intensive care and telemetry ward monitors. High-frequency time-series streams of electrocardiogram (ECG), photoplethysmography (PPG), arterial blood pressure, and core temperature are sampled at 125Hz. A continuous temporal transformer extracts cross-vital-sign entropy, micro-vascular tone oscillations, and autonomic dysfunction signatures while filtering sensor disconnect artifacts. The model outputs a continuous Sepsis Risk Score (0-100) calibrated against SOFA (Sequential Organ Failure Assessment) scores, accompanied by patient-specific physiological drivers. Clinical validation across 40,000 patient stays demonstrates 88% sensitivity and 92% specificity for septic shock onset 12 hours prior to hypotensive crash, allowing prompt intervention with intravenous antibiotics and fluid resuscitation.",
        "assignee": "VitalAI Clinical Technologies",
        "publication_date": "2026-05-25",
        "country": "US",
        "ipc_class": "A61B 5/0205",
    },
    {
        "id": "US-2026-014",
        "title": "Quadruped Robot Locomotion with Reinforcement Learning and Real-Time Terrain Elevation Mapping",
        "abstract": "A dynamic locomotion control framework for legged robots that integrates proprioceptive joint feedback with forward-facing depth cameras to synthesize compliant gait policies over uneven, slippery, and obstacle-laden terrains.",
        "description": "The robotic control architecture comprises an integrated perception-actuation stack for dynamic quadruped locomotion. An onboard depth camera and solid-state LiDAR feed a real-time 2.5D elevation mapping module that reconstructs surrounding micro-topography at 50Hz. A teacher-student reinforcement learning framework trained with privileged simulation physics transfers robust locomotion policies to physical hardware. Proprioceptive motor encoders and 6-axis IMUs compute foot contact forces and slip probabilities at 1kHz. When stepping on loose gravel, ice, or stairs, the policy dynamically adjusts foot placement vectors, swing-leg trajectories, and impedance stiffness parameters. The system maintains stable 3.5 m/s trotting and recovers gracefully from lateral impacts exceeding 150 Newtons.",
        "assignee": "Apex Legged Robotics",
        "publication_date": "2026-06-02",
        "country": "US",
        "ipc_class": "B25J 9/16",
    },
    {
        "id": "US-2026-015",
        "title": "Reconfigurable Intelligent Surface (RIS) for 6G Wireless Beamforming and Non-Line-of-Sight Coverage",
        "abstract": "An active metamaterial surface array featuring phase-tunable varactor elements and distributed micro-controllers to dynamically manipulate radio frequency wavefronts for 6G millimeter-wave and sub-terahertz signal reflection.",
        "description": "A reconfigurable intelligent surface (RIS) system for next-generation telecommunications is provided. The metasurface comprises 1024 passive planar unit cells arranged in a two-dimensional grid operating in the 28 GHz and 140 GHz frequency bands. Each unit cell incorporates positive-intrinsic-negative (PIN) diodes or graphene varactors providing 360-degree continuous phase reflection control with under 1.2 dB insertion loss. A low-complexity distributed controller interfaces with base stations via 5G control channels and computes beam steering codebooks using holographic wavefront synthesis. The surface refracts and focuses reflected beams around urban building blockages, increasing received signal-to-noise ratio (SNR) by 24 dB in non-line-of-sight (NLOS) dead zones while consuming less than 15 watts of total operating power.",
        "assignee": "WaveFront 6G Systems",
        "publication_date": "2026-06-12",
        "country": "US",
        "ipc_class": "H04B 7/06",
    },
    {
        "id": "US-2026-016",
        "title": "CRISPR-Cas12f Ultra-Compact Gene Editing System for In Vivo Therapeutic Delivery",
        "abstract": "An engineered miniaturized Cas12f endonuclease with enhanced cleavage activity and specificity, capable of packaging along with guide RNA into a single adeno-associated virus (AAV) vector for in vivo gene therapy.",
        "description": "The present invention relates to an engineered Cas12f enzyme derived from uncultivated archaea, possessing a compact polypeptide size of 420 to 490 amino acids. Mutational engineering at the target-bound active site (introducing substitutions D143R and E210K) enhances DNA double-strand cleavage kinetics by 18-fold compared to wild-type enzymes. Due to its minimal genetic payload size (<1.4 kb), the complete endonuclease coding sequence, promoter, polyA tail, and a dual-guide RNA cassette fit within the 4.7 kb packaging threshold of a single AAV8 or AAV9 viral capsid. In vivo systemic delivery targeting the PCSK9 gene in murine models demonstrates 68% indel efficiency and a 72% reduction in circulating LDL cholesterol with zero detected off-target cleavages across genome-wide CIRCLE-seq analysis.",
        "assignee": "GenomePrecision Therapeutics",
        "publication_date": "2026-06-20",
        "country": "US",
        "ipc_class": "C12N 15/113",
    },
    {
        "id": "US-2026-017",
        "title": "Sodium-Ion Battery with Prussian White Cathode and Hard Carbon Anode for Grid Storage",
        "abstract": "A low-cost, resource-abundant sodium-ion battery chemistry featuring a defect-free monoclinic Prussian white cathode material and a biomass-derived porous hard carbon anode delivering 160 Wh/kg with over 4,000 cycle lifetime.",
        "description": "The disclosure provides a non-aqueous sodium-ion secondary battery optimized for utility-scale grid energy storage. The cathode comprises monoclinic sodium iron hexacyanoferrate (Na2-xFe[Fe(CN)6]) with a low vacancy density (<3%) and bound water content under 0.5%, synthesized via chelating-assisted hydrothermal crystallization. The anode comprises pyrolyzed lignin-derived hard carbon featuring expanded graphene interlayer spacing (d002 = 0.38nm) to facilitate sodium ion insertion and plateau pore-filling. The electrolyte consists of 1.0 M NaPF6 dissolved in ethylene carbonate and diethyl carbonate with 2 vol% fluoroethylene carbonate (FEC) additive. The assembled cell demonstrates a specific energy of 165 Wh/kg at 1C discharge rate, exceptional low-temperature capacity retention (82% at -20°C), and negligible capacity fade over 4,000 full charge-discharge cycles.",
        "assignee": "TerraSodium Energy",
        "publication_date": "2026-06-28",
        "country": "US",
        "ipc_class": "H01M 10/054",
    },
    {
        "id": "US-2026-018",
        "title": "Precision Agricultural Robot with Multispectral Crop Disease Detection and Micro-Dose Spraying",
        "abstract": "An autonomous field robotics platform utilizing high-resolution multispectral cameras, real-time edge segmentation, and ultrasonic micro-nozzles to identify weed and pathogen infestations and apply targeted treatments.",
        "description": "The agricultural robot system comprises an autonomous wheeled rover with independent four-wheel steering and electric portal axles. A sensor boom carries six multispectral cameras capturing red, green, blue, red-edge (705nm), and near-infrared (842nm) bands at 30 fps. An onboard edge AI vision transformer processes individual plant canopies at 15 centimeters ground resolution, calculating normalized difference vegetation indices (NDVI) and classifying early-stage fungal blight, nutrient deficiency, or weed species. A high-speed solenoid-actuated micro-nozzle array dispenses targeted herbicide or fungicide droplets with millimeter precision directly onto affected leaves while the rover traverses fields at 8 km/h. Field trials confirm a 91% reduction in total chemical volume compared to traditional broadcast spraying.",
        "assignee": "AgroRobotics Precision",
        "publication_date": "2026-07-05",
        "country": "US",
        "ipc_class": "A01M 7/00",
    },
    {
        "id": "US-2026-019",
        "title": "Satellite Constellation Intersatellite Optical Laser Mesh Routing Protocol",
        "abstract": "A dynamic spatial mesh networking protocol for low-Earth-orbit (LEO) satellite constellations utilizing coherent optical laser cross-links with predictive topological rerouting to achieve low-latency global data transit.",
        "description": "The invention provides an autonomous intersatellite optical routing system for megaconstellations of 1,000+ LEO satellites. Each spacecraft is equipped with four gimbal-stabilized optical communication terminals (OCTs) operating at 1550nm with 100 Gbps coherent transceivers across inter-plane and intra-plane link distances up to 5,000 kilometers. A predictive topological routing daemon maintains orbital ephemeris projections and anticipates line-of-sight disruptions from Earth limb occultation or solar blinding. Data packets are routed using a multi-commodity flow optimization algorithm with priority queueing, maintaining end-to-end packet jitter under 0.5 milliseconds and sub-60ms transatlantic latency from London to New York.",
        "assignee": "OrbitalMesh Telecom",
        "publication_date": "2026-07-12",
        "country": "US",
        "ipc_class": "H04B 10/118",
    },
    {
        "id": "US-2026-020",
        "title": "Thermal Runaway Mitigation Barrier for Electric Vehicle Battery Modules using Aerogel Composites",
        "abstract": "A lightweight ceramic-silica aerogel composite thermal insulation sheet placed between prismatic battery cells to suppress cell-to-cell thermal propagation during internal short-circuit events up to 1200°C.",
        "description": "The present disclosure provides an ultra-thin fireproof compression pad for lithium-ion battery modules. The composite sheet consists of a silica aerogel matrix reinforced with pre-oxidized polyacrylonitrile (PAN) and ceramic mullite microfibers, having a total thickness of 1.2 to 2.5 millimeters. The material exhibits a thermal conductivity of 0.018 W/(m·K) at room temperature and an intumescent inorganic mineral coating that forms an expanded ceramic crust upon exposure to flame. During catastrophic thermal runaway of an adjacent 200 Ah prismatic NMC811 cell reaching 1150°C, the barrier maintains the temperature of neighboring cells below 80°C for over 20 minutes, preventing cascading thermal propagation and module fire without exceeding battery pack volumetric space allowances.",
        "assignee": "PyroShield Materials",
        "publication_date": "2026-07-20",
        "country": "US",
        "ipc_class": "H01M 50/40",
    },
    {
        "id": "US-2026-021",
        "title": "AI-Guided Robotic Surgical System with Real-Time Sub-Millimeter Tissue Deformation Tracking",
        "abstract": "A minimally invasive surgical robotic system combining stereoscopic 3D endoscopes with real-time finite element biomechanical modeling to compensate for organ tissue deformation and provide augmented reality boundary guidance.",
        "description": "The robotic tele-surgery platform comprises a master surgeon console, articulated slave manipulator arms, and a 4K 3D surgical endoscope. A stereo visual-inertial tracking algorithm estimates sub-millimeter surgical tool tip coordinates in 6 degrees of freedom. A real-time GPU-accelerated non-linear finite element model (FEM) simulates organ compliance, breathing motion, and surgical incision deformation based on preoperative MRI/CT meshes. The system projects augmented reality overlays showing subsurface blood vessels and tumor resection margins with 0.4mm accuracy directly onto the surgeon's 3D viewer. Haptic force-feedback actuators on master manipulators actively resist movement that would breach critical vascular safety margins, reducing accidental tissue laceration by 94%.",
        "assignee": "SurgicalPrecision AI",
        "publication_date": "2026-07-28",
        "country": "US",
        "ipc_class": "A61B 34/30",
    },
    {
        "id": "US-2026-022",
        "title": "Direct Air Capture (DAC) Contact Module with Metal-Organic Framework Sorbents",
        "abstract": "A scalable direct air capture contactor using structured metal-organic framework (MOF) hollow fiber sorbents and low-grade geothermal heat desorption to extract CO2 directly from ambient atmosphere at under $100/ton.",
        "description": "The invention provides an energy-efficient direct air capture (DAC) system for atmospheric carbon dioxide removal. Ambient air is drawn through structured honeycomb monolith contactors coated with amine-functionalized Mg-MOF-74 or CALF-20 metal-organic framework nanocrystals. The sorbent demonstrates an equilibrium CO2 working capacity of 2.8 mmol/g from air containing 420 ppm CO2 at 50% relative humidity. Regeneration is conducted in a vacuum temperature-swing adsorption (VTSA) cycle using low-grade waste steam at 85°C to 100°C. The process captures 95% pure CO2 suitable for geological sequestration or synthetic e-fuel synthesis, operating with a specific energy consumption of 1.2 MWh thermal and 250 kWh electrical per metric ton of captured CO2.",
        "assignee": "AtmosPure Carbon Technologies",
        "publication_date": "2026-08-04",
        "country": "US",
        "ipc_class": "B01D 53/04",
    },
    {
        "id": "US-2026-023",
        "title": "Electric Vertical Takeoff and Landing (eVTOL) Tilt-Rotor Flight Controller with Fault-Tolerant Thrust Vectoring",
        "abstract": "A redundant fly-by-wire flight control computer for eVTOL aircraft that manages transition between vertical hover and horizontal wing-borne flight while autonomously compensating for single-rotor failures.",
        "description": "The flight control architecture provides autonomous stabilization and trajectory tracking for tilt-rotor eVTOL passenger aircraft configured with eight distributed electric propellers mounted on tilting wing pods. A triple-modular redundant (TMR) flight computer samples inertial measurement units, air data probes, and control surface positions at 200Hz. Dynamic inversion control laws blend aerodynamic aileron/elevator deflections with individual rotor rpm and tilt-angle commands across the complete flight envelope from 0 to 180 knots. In the event of an electric motor or inverter failure, the control allocator instantly reconfigures remaining propulsor thrust vectors within 20 milliseconds, maintaining altitude and controlled descent without pilot intervention.",
        "assignee": "AeroFlight Dynamics",
        "publication_date": "2026-08-12",
        "country": "US",
        "ipc_class": "B64C 29/00",
    },
    {
        "id": "US-2026-024",
        "title": "Digital Pathology Whole-Slide Vision Transformer with Tumor Microenvironment Profiling",
        "abstract": "A computational pathology artificial intelligence platform analyzing gigapixel whole-slide histology images using hierarchical vision transformers to quantify tumor infiltrating lymphocytes and predict immunotherapy response.",
        "description": "The deep learning digital pathology platform processes gigapixel histopathology slides stained with hematoxylin and eosin (H&E). The system uses a two-level hierarchical vision transformer: a tile-level encoder operating on 256x256 pixel patches at 20x magnification, and an attention slide-level aggregator that integrates spatial interactions across 50,000 tiles. The network outputs spatial heatmaps delineating invasive tumor boundaries, necrotic areas, stromal compartments, and tumor-infiltrating lymphocyte (TIL) densities. A biomarker prediction head correlates cellular microenvironment morphology with PD-L1 expression levels and microsatellite instability (MSI-H), predicting patient response to immune checkpoint inhibitor therapies with an area under the ROC curve (AUC) of 0.93.",
        "assignee": "HistoLogic AI Diagnostics",
        "publication_date": "2026-08-20",
        "country": "US",
        "ipc_class": "G16H 20/10",
    },
    {
        "id": "US-2026-025",
        "title": "High-Bandwidth 3D Chiplet Interconnect with Micro-Bumps and Low-Loss Silicon Interposers",
        "abstract": "A semiconductor packaging architecture integrating heterogeneous processor chiplets, high-bandwidth memory (HBM3e) dies, and optical transceivers on a passive silicon interposer with 25-micron micro-bump pitch.",
        "description": "The disclosure provides an advanced multi-die 2.5D/3D packaging system for artificial intelligence accelerators and high-performance computing. A high-density silicon interposer incorporates five levels of dual-damascene copper interconnect wiring with 0.8um line and space dimensions. Processing logic chiplets (GPU/TPU) fabricated on sub-3nm nodes are joined to the interposer using micro-bumps at a 25-micrometer pitch with low-melting-point solder and non-conductive film (NCF). Eight 12-high HBM3e memory stacks surround the compute dies, providing over 9.6 TB/s aggregate memory bandwidth. Deep trench capacitors (DTC) embedded in the interposer deliver 350 nF/mm2 decoupling capacitance, reducing transient power supply voltage droop by 60% during high-power AI inference bursts.",
        "assignee": "SiliconBridge Packaging",
        "publication_date": "2026-08-28",
        "country": "US",
        "ipc_class": "H01L 25/065",
    },
    {
        "id": "US-2026-026",
        "title": "Wearable Closed-Loop EEG System for Real-Time Epileptic Seizure Suppression",
        "abstract": "A non-invasive wearable headband with flexible dry EEG electrodes and an ultra-low power neuromorphic processor that detects pre-ictal seizure biomarkers and triggers transcranial electrical stimulation to suppress seizures.",
        "description": "The medical device comprises an unobtrusive wearable headgear housing sixteen dry polymer electrodes with silver nanowire coatings for multi-channel electroencephalogram (EEG) acquisition. An analog front-end with 120 dB common-mode rejection ratio filters EMG and eye-blink motion artifacts. An ultra-low power spiking neural network chip evaluates phase-amplitude coupling and synchrony changes in the gamma and theta frequency bands. Upon identifying pre-ictal electrographic patterns with a 95% confidence threshold (typically 2 to 5 minutes prior to clinical seizure onset), the device activates bipolar transcranial alternating current stimulation (tACS) through temporal electrodes to disrupt pathological neuronal hypersynchrony, reducing clinical seizure frequency by 78% in refractory epilepsy patients.",
        "assignee": "NeuroShield Therapeutics",
        "publication_date": "2026-09-05",
        "country": "US",
        "ipc_class": "A61N 1/36",
    },
    {
        "id": "US-2026-027",
        "title": "Automated Smart Contract Vulnerability Detection via Graph Neural Networks and Symbolic Execution",
        "abstract": "A software security audit system that decompiles EVM bytecode into control-flow and data-dependency graph representations, using graph neural networks and concolic testing to identify reentrancy, integer overflow, and flash-loan vulnerabilities.",
        "description": "The vulnerability scanning system provides automated formal auditing for Ethereum and EVM-compatible smart contracts. Input Solidity source code or compiled bytecode is converted into a multi-relational code property graph (CPG) linking abstract syntax trees, control flow graphs, and def-use variable dependency chains. A Relational Graph Convolutional Network (R-GCN) scans the graph to pinpoint suspicious patterns characteristic of reentrancy exploits, flash loan price oracle manipulation, delegatecall injection, and unchecked return values. A symbolic execution engine then generates concrete test payloads to prove reachability and exploitability of the detected vulnerability without false positives. The audit engine processes complex DeFi protocols comprising over 20 contracts in under 3 minutes with 98.4% detection accuracy.",
        "assignee": "BlockAudit Security",
        "publication_date": "2026-09-15",
        "country": "US",
        "ipc_class": "G06F 21/57",
    },
    {
        "id": "US-2026-028",
        "title": "Solid Oxide Fuel Cell (SOFC) with Nanostructured Ceria-Zirconia Electrolyte for Direct Methane Conversion",
        "abstract": "An intermediate-temperature solid oxide fuel cell operating at 550°C to 650°C featuring a nanostructured samaria-doped ceria electrolyte and cermet anode that allows direct reforming of natural gas and biogas without coking.",
        "description": "A high-efficiency solid oxide fuel cell (SOFC) stack for stationary power generation is disclosed. The cell incorporates an anode-supported planar configuration with a 10-micrometer thick samaria-doped ceria (SDC) electrolyte film deposited by pulsed laser deposition, achieving ionic conductivity of 0.08 S/cm at 600°C. The anode consists of a nickel-SDC-copper cermet infiltrated with barium oxide nanoparticles, which catalytically reforms natural gas, biomethane, or industrial methane directly on the electrode without carbon soot deposition or sulfur poisoning. The cathode comprises lanthanum strontium cobalt ferrite (LSCF) with high oxygen reduction reaction activity. The system achieves a single-cell peak power density of 1.4 W/cm2 at 600°C with 64% net electrical conversion efficiency in combined heat and power (CHP) operation.",
        "assignee": "CleanFuel Cell Energy",
        "publication_date": "2026-09-22",
        "country": "US",
        "ipc_class": "H01M 8/12",
    },
    {
        "id": "US-2026-029",
        "title": "Sparse Cross-Attention Transformer for Million-Token Document Context Windows",
        "abstract": "A deep learning transformer architecture utilizing linear state-space models combined with block-sparse cross-attention, enabling sequence lengths exceeding 1,000,000 tokens on standard GPU hardware with sub-quadratic memory scaling.",
        "description": "The architecture provides an efficient transformer implementation for ultra-long context understanding across entire codebases, technical manuals, and multi-hour audio streams. The network replaces standard quadratic self-attention layers with a hybrid pipeline comprising continuous state-space recurrence layers (Mamba/S4) interleaved with block-diagonal sliding-window attention and global landmark token routing. Key-value (KV) caches are compressed through dynamic 4-bit INT quantization and attention head pruning. Flash-attention memory layout optimizations ensure that processing a 1,000,000 token document context requires only 16 GB of GPU VRAM while maintaining full needle-in-a-haystack retrieval accuracy (100% across all depth percentiles).",
        "assignee": "ScaleModel Neural Labs",
        "publication_date": "2026-09-30",
        "country": "US",
        "ipc_class": "G06N 3/04",
    },
    {
        "id": "US-2026-030",
        "title": "Photonic Analog Matrix Multiplier for Ultra-Fast Deep Learning Inference",
        "abstract": "An optical computing integrated circuit utilizing silicon photonics waveguide arrays and micro-ring resonators to perform matrix-vector multiplication with speed-of-light propagation and sub-picosecond latency.",
        "description": "The photonic computing processor implements parallel linear algebra computations using coherent laser sources operating at 1550nm. Input vector values are modulated onto optical carrier amplitudes using 64 high-speed electro-absorption modulators operating at 40 GHz. The optical signals pass through a crossbar mesh of silicon-on-insulator (SOI) waveguides coupled with thermal and electro-optic micro-ring resonators (MRRs) encoding matrix weight parameters. The light intensity exiting each column waveguide is detected by high-speed germanium balanced photodetectors performing optical current summation. The device performs 40 Tera-operations per second (TOPS) in the optical domain while dissipating less than 8 watts of electrical power, overcoming capacitive RC delay limitations of digital silicon chips.",
        "assignee": "LightSpeed Photonic Systems",
        "publication_date": "2026-10-08",
        "country": "US",
        "ipc_class": "G06E 3/00",
    },
]

def main():
    print(f"Reading existing patents from {CSV_PATH}...")
    import pandas as pd
    existing_df = pd.read_csv(CSV_PATH)
    print(f"Current total patents in CSV: {len(existing_df)}")

    existing_ids = set(existing_df["id"].tolist())
    to_add = [p for p in NEW_PATENTS if p["id"] not in existing_ids]

    if not to_add:
        print("All new patents already exist in patents.csv!")
    else:
        print(f"Adding {len(to_add)} new patents to patents.csv...")
        new_df = pd.DataFrame(to_add)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        combined_df.to_csv(CSV_PATH, index=False, quoting=csv.QUOTE_MINIMAL)
        print(f"Successfully saved updated patents.csv! New total: {len(combined_df)} patents.")

    # Now run build_index.py logic
    print("\nRebuilding FAISS Index and Metadata...")
    from scripts.build_index import build_index
    build_index()
    print("\nAll done! Dataset expanded and FAISS index successfully rebuilt.")

if __name__ == "__main__":
    main()

