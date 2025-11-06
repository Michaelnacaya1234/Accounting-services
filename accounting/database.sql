-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 04, 2025 at 01:27 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dbaccounting`

CREATE DATABASE IF NOT EXISTS `dbaccounting` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `dbaccounting`;
--

-- --------------------------------------------------------

--
-- Table structure for table `tblbusiness`
--

CREATE TABLE `tblbusiness` (
  `Business_id` int(11) NOT NULL,
  `Business_name` varchar(150) NOT NULL,
  `Sales` decimal(15,2) DEFAULT NULL,
  `Business_type_id` int(11) DEFAULT NULL,
  `Location` varchar(255) DEFAULT NULL,
  `Business_permit` varchar(100) DEFAULT NULL,
  `SPA` varchar(100) DEFAULT NULL,
  `Client_ID` int(11) DEFAULT NULL,
  `DTI` varchar(100) DEFAULT NULL,
  `User_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tblclient`
--

CREATE TABLE `tblclient` (
  `Client_ID` int(11) NOT NULL,
  `First_name` varchar(100) NOT NULL,
  `Middle_name` varchar(100) DEFAULT NULL,
  `Last_name` varchar(100) NOT NULL,
  `Email` varchar(150) DEFAULT NULL,
  `Date_of_birth` date DEFAULT NULL,
  `Gender` enum('Male','Female','Other') DEFAULT NULL,
  `Phone` varchar(20) DEFAULT NULL,
  `Address` text DEFAULT NULL,
  `Tin_no` varchar(20) DEFAULT NULL,
  `Status_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tbluser`
--

CREATE TABLE `tbluser` (
  `User_id` int(11) NOT NULL,
  `Username` varchar(100) NOT NULL,
  `Password` varchar(255) NOT NULL,
  `Role_id` int(11) DEFAULT NULL,
  `Client_id` int(11) DEFAULT NULL,
  `Email` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tblbusiness`
--
ALTER TABLE `tblbusiness`
  ADD PRIMARY KEY (`Business_id`),
  ADD KEY `Client_ID` (`Client_ID`),
  ADD KEY `User_id` (`User_id`);

--
-- Indexes for table `tblclient`
--
ALTER TABLE `tblclient`
  ADD PRIMARY KEY (`Client_ID`),
  ADD UNIQUE KEY `Email` (`Email`);

--
-- Indexes for table `tbluser`
--
ALTER TABLE `tbluser`
  ADD PRIMARY KEY (`User_id`),
  ADD UNIQUE KEY `Username` (`Username`),
  ADD UNIQUE KEY `Email` (`Email`),
  ADD KEY `Client_id` (`Client_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tblbusiness`
--
ALTER TABLE `tblbusiness`
  MODIFY `Business_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tblclient`
--
ALTER TABLE `tblclient`
  MODIFY `Client_ID` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tbluser`
--
ALTER TABLE `tbluser`
  MODIFY `User_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tblbusiness`
--
ALTER TABLE `tblbusiness`
  ADD CONSTRAINT `tblbusiness_ibfk_1` FOREIGN KEY (`Client_ID`) REFERENCES `tblclient` (`Client_ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `tblbusiness_ibfk_2` FOREIGN KEY (`User_id`) REFERENCES `tbluser` (`User_id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `tbluser`
--
ALTER TABLE `tbluser`
  ADD CONSTRAINT `tbluser_ibfk_1` FOREIGN KEY (`Client_id`) REFERENCES `tblclient` (`Client_ID`) ON DELETE SET NULL ON UPDATE CASCADE;
-- Seed/Reset admin user (login.php supports plaintext fallback)
INSERT INTO `tbluser` (`Username`, `Password`, `Role_id`, `Client_id`, `Email`)
VALUES ('admin@gmail.com', 'admin123', 1, NULL, NULL)
ON DUPLICATE KEY UPDATE `Password` = VALUES(`Password`), `Role_id` = COALESCE(`tbluser`.`Role_id`, VALUES(`Role_id`));

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
