-- Create trade type enum and templates
DO $$ BEGIN
  CREATE TYPE trade_type AS ENUM (
    'general', 'electrical', 'plumbing', 'hvac', 'concrete', 'roofing',
    'framing', 'drywall', 'flooring', 'painting', 'masonry', 'landscaping'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS trade_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade trade_type NOT NULL UNIQUE,
  label jsonb NOT NULL DEFAULT '{}',
  fields jsonb NOT NULL DEFAULT '[]',
  icon text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trade_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade templates public read"
  ON trade_templates FOR SELECT
  USING (true);

-- Add trade column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trade trade_type NOT NULL DEFAULT 'general';

-- Add trade_metadata to photos
ALTER TABLE photos ADD COLUMN IF NOT EXISTS trade_metadata jsonb DEFAULT '{}';

-- Seed trade templates
INSERT INTO trade_templates (trade, label, fields, sort_order) VALUES
  ('general', '{"en":"General Construction","de":"Allgemeiner Bau","mk":"Општа градба","sl":"Splošna gradnja","sr":"Opšta gradnja"}',
   '[{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["New Construction","Renovation","Demolition","Inspection"],"mk":["Нов објект","Реновација","Демолиција","Инспекција"]}},{"key":"description","type":"textarea","label":{"en":"Description","mk":"Опис"},"required":true},{"key":"materials","type":"text","label":{"en":"Materials Used","mk":"Користени материјали"},"required":false}]', 1),
  ('electrical', '{"en":"Electrical","de":"Elektroinstallation","mk":"Електрика","sl":"Elektrika","sr":"Elektrika"}',
   '[{"key":"circuit","type":"text","label":{"en":"Circuit #","mk":"Коло #"},"required":true},{"key":"voltage","type":"select","label":{"en":"Voltage","mk":"Напон"},"required":true,"options":{"en":["120V","240V","400V","Low Voltage"],"mk":["120V","240V","400V","Низок напон"]}},{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["Wiring","Panel Installation","Outlet","Lighting","Grounding","Inspection"],"mk":["Инсталација","Панел монтажа","Приклучок","Осветлување","Земјоврзување","Инспекција"]}},{"key":"permitNumber","type":"text","label":{"en":"Permit #","mk":"Дозвола #"},"required":false}]', 2),
  ('plumbing', '{"en":"Plumbing","de":"Sanitär","mk":"Водовод","sl":"Vodovod","sr":"Vodovod"}',
   '[{"key":"pipeType","type":"select","label":{"en":"Pipe Type","mk":"Тип на цевки"},"required":true,"options":{"en":["Copper","PVC","PEX","Galvanized"],"mk":["Бакар","PVC","PEX","Галванизиран"]}},{"key":"pressureTested","type":"checkbox","label":{"en":"Pressure Tested","mk":"Тестиран под притисок"},"required":false},{"key":"workType","type":"select","label":{"en":"Work Type","mk":"Тип на работа"},"required":true,"options":{"en":["Supply Line","Drain","Fixture Installation","Water Heater","Sewer"],"mk":["Довод","Одвод","Монтажа","Бојлер","Канализација"]}}]', 3),
  ('hvac', '{"en":"HVAC","de":"Heizung/Lüftung","mk":"Греење/Вентилација","sl":"Ogrevanje/prezračevanje","sr":"Grejanje/ventilacija"}',
   '[{"key":"systemType","type":"select","label":{"en":"System Type","mk":"Тип на систем"},"required":true,"options":{"en":["Split Unit","Central AC","Heat Pump","Furnace","Ductwork","Ventilation"],"mk":["Сплит","Централен клима","Топлинска пумпа","Печка","Канали","Вентилација"]}},{"key":"capacity","type":"text","label":{"en":"Capacity (BTU/kW)","mk":"Капацитет (BTU/kW)"},"required":false},{"key":"refrigerantType","type":"text","label":{"en":"Refrigerant Type","mk":"Тип на ладилно средство"},"required":false}]', 4),
  ('concrete', '{"en":"Concrete","de":"Beton","mk":"Бетон","sl":"Beton","sr":"Beton"}',
   '[{"key":"concreteClass","type":"select","label":{"en":"Concrete Class","mk":"Класа на бетон"},"required":true,"options":{"en":["C20/25","C25/30","C30/37","C35/45","C40/50"],"mk":["C20/25","C25/30","C30/37","C35/45","C40/50"]}},{"key":"reinforcement","type":"select","label":{"en":"Reinforcement","mk":"Арматура"},"required":true,"options":{"en":["Rebar #3","Rebar #4","Rebar #5","Mesh","None"],"mk":["Арматура #3","Арматура #4","Арматура #5","Мрежа","Нема"]}},{"key":"volume","type":"text","label":{"en":"Volume (m³)","mk":"Волумен (m³)"},"required":false},{"key":"curingMethod","type":"select","label":{"en":"Curing Method","mk":"Метод на нега"},"required":true,"options":{"en":["Water Curing","Curing Compound","Wet Covering","None"],"mk":["Водена нега","Хемиска","Влажна покривка","Нема"]}}]', 5),
  ('roofing', '{"en":"Roofing","de":"Dachdeckung","mk":"Покрив","sl":"Strešna kritina","sr":"Krov"}',
   '[{"key":"material","type":"select","label":{"en":"Material","mk":"Материјал"},"required":true,"options":{"en":["Clay Tile","Concrete Tile","Metal Sheet","Bitumen","EPDM","Green Roof"],"mk":["Глинени ќерамиди","Бетонски ќерамиди","Метален лим","Битумен","EPDM","Зелен покрив"]}},{"key":"slope","type":"text","label":{"en":"Slope (°)","mk":"Наклон (°)"},"required":false},{"key":"insulationType","type":"select","label":{"en":"Insulation Type","mk":"Тип на изолација"},"required":true,"options":{"en":["Mineral Wool","EPS","PIR","PU Foam","None"],"mk":["Минерална волна","EPS","PIR","PU пена","Нема"]}}]', 6)
ON CONFLICT (trade) DO NOTHING;
