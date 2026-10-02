-- Expand the catalog without changing bank IDs on existing accounts.
alter type public.supported_bank add value if not exists 'av_villas';
alter type public.supported_bank add value if not exists 'banco_agrario';
alter type public.supported_bank add value if not exists 'banco_caja_social';
alter type public.supported_bank add value if not exists 'banco_de_bogota';
alter type public.supported_bank add value if not exists 'banco_de_occidente';
alter type public.supported_bank add value if not exists 'banco_popular';
alter type public.supported_bank add value if not exists 'davibank';
alter type public.supported_bank add value if not exists 'daviplata';
alter type public.supported_bank add value if not exists 'davivienda';
alter type public.supported_bank add value if not exists 'finandina';
alter type public.supported_bank add value if not exists 'gnb_sudameris';
alter type public.supported_bank add value if not exists 'itau';
alter type public.supported_bank add value if not exists 'lulo';
alter type public.supported_bank add value if not exists 'pibank';

notify pgrst, 'reload schema';
