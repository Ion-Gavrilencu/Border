--
-- PostgreSQL database dump
--

\restrict ZLFJv1f9bTCXisA0DtIZZmpEqd2tjm2xu9d2AHkNMQWmwgrhIfdq0sIihOeu3ne

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    attachment_type character varying(20) NOT NULL,
    file_category character varying(20),
    name character varying(255) NOT NULL,
    original_name character varying(255),
    file_path text,
    mime_type character varying(150),
    file_size bigint,
    url text,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT attachments_attachment_type_check CHECK (((attachment_type)::text = ANY ((ARRAY['file'::character varying, 'link'::character varying])::text[]))),
    CONSTRAINT attachments_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['telegrame'::character varying, 'ordine'::character varying, 'legislatie'::character varying, 'informatii_utile'::character varying])::text[]))),
    CONSTRAINT attachments_file_category_check CHECK (((file_category IS NULL) OR ((file_category)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'pdf'::character varying, 'word'::character varying, 'other'::character varying])::text[])))),
    CONSTRAINT attachments_file_or_link CHECK (((((attachment_type)::text = 'file'::text) AND (file_path IS NOT NULL) AND (url IS NULL)) OR (((attachment_type)::text = 'link'::text) AND (url IS NOT NULL) AND (file_path IS NULL))))
);


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: informatii_utile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.informatii_utile (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(100),
    content text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: informatii_utile_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.informatii_utile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: informatii_utile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.informatii_utile_id_seq OWNED BY public.informatii_utile.id;


--
-- Name: legislatie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legislatie (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    law_number character varying(100),
    law_date date,
    content text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legislatie_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.legislatie_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: legislatie_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.legislatie_id_seq OWNED BY public.legislatie.id;


--
-- Name: ordine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordine (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    number character varying(100),
    order_date date,
    content text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ordine_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordine_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordine_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordine_id_seq OWNED BY public.ordine.id;


--
-- Name: telegrame; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegrame (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    number character varying(100),
    telegram_date date,
    content text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: telegrame_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.telegrame_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: telegrame_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.telegrame_id_seq OWNED BY public.telegrame.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'USER'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    activation_token_hash text,
    activation_expires_at timestamp without time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    session_version integer DEFAULT 0 NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: informatii_utile id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informatii_utile ALTER COLUMN id SET DEFAULT nextval('public.informatii_utile_id_seq'::regclass);


--
-- Name: legislatie id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legislatie ALTER COLUMN id SET DEFAULT nextval('public.legislatie_id_seq'::regclass);


--
-- Name: ordine id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordine ALTER COLUMN id SET DEFAULT nextval('public.ordine_id_seq'::regclass);


--
-- Name: telegrame id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegrame ALTER COLUMN id SET DEFAULT nextval('public.telegrame_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: informatii_utile informatii_utile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informatii_utile
    ADD CONSTRAINT informatii_utile_pkey PRIMARY KEY (id);


--
-- Name: legislatie legislatie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legislatie
    ADD CONSTRAINT legislatie_pkey PRIMARY KEY (id);


--
-- Name: ordine ordine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordine
    ADD CONSTRAINT ordine_pkey PRIMARY KEY (id);


--
-- Name: telegrame telegrame_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegrame
    ADD CONSTRAINT telegrame_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_attachments_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id);


--
-- Name: idx_attachments_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachments_uploaded_by ON public.attachments USING btree (uploaded_by);


--
-- Name: users_username_unique_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_unique_ci ON public.users USING btree (lower((username)::text));


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: informatii_utile informatii_utile_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informatii_utile
    ADD CONSTRAINT informatii_utile_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: legislatie legislatie_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legislatie
    ADD CONSTRAINT legislatie_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ordine ordine_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordine
    ADD CONSTRAINT ordine_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: telegrame telegrame_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegrame
    ADD CONSTRAINT telegrame_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ZLFJv1f9bTCXisA0DtIZZmpEqd2tjm2xu9d2AHkNMQWmwgrhIfdq0sIihOeu3ne

