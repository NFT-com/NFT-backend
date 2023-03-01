CREATE TABLE IF NOT EXISTS public.mints (
   date date default current_date,
   freemints integer NOT NULL,
   usedmints integer NOT NULL,
   gkincirculation integer NOT NULL,
   gkunclaimed integer NOT NULL,
   treasuryunclaimed integer NOT NULL,
   insiderunclaimed integer NOT NULL,
   publicmints integer NOT NULL
);
